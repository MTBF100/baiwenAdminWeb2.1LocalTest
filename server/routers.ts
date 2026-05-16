import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router, protectedProcedure, adminProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { invokeLLM } from "./_core/llm";
import { hashPassword, verifyPassword, signSessionToken } from "./auth";
import { syncCollection } from "./etl";
import { updateDocument, deleteDocument } from "./wxcloud";


const paginationInput = z.object({
  page: z.number().min(1).default(1),
  pageSize: z.number().min(1).max(100).default(20),
});

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
    .input(
      z.object({
        username: z.string().min(1, "用户名不能为空"),
        password: z.string().min(1, "密码不能为空"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // 1. 查找用户
      const user = await db.getUserByUsername(input.username);
      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }
      // 2. 验证密码
      if (!user.passwordHash) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "该账号未设置密码，请联系管理员",
        });
      }
      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }
      // 3. 检查是否为管理员
      if (user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "无权限访问管理后台",
        });
      }
      // 4. 签发 JWT
      const token = await signSessionToken({
        openId: user.openId,
        name: user.name || user.username || "管理员",
        expiresInMs: ONE_YEAR_MS,
      });
      // 5. 设置 session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });
      // 6. 更新最后登录时间
      await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        },
      } as const;
    }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    initAdmin: publicProcedure
    .input(
      z.object({
        username: z.string().min(3, "用户名至少 3 个字符").max(32),
        password: z.string().min(8, "密码至少 8 个字符"),
        name: z.string().min(1, "显示名称不能为空"),
        email: z.string().email().optional(),
        initSecret: z.string().min(1, "初始化密钥不能为空"),
      })
    )
    .mutation(async ({ input }) => {
      // 验证初始化密钥（防止未授权人员创建管理员）
      const expectedSecret = process.env.ADMIN_INIT_SECRET;
      if (!expectedSecret || input.initSecret !== expectedSecret) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "初始化密钥错误",
        });
      }
      // 检查是否已存在 admin
      const existing = await db.getAdminUsers();
      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "管理员账号已存在，请直接登录",
        });
      }
      // 创建管理员
      const passwordHash = await hashPassword(input.password);
      const user = await db.createAdminUser({
        username: input.username,
        passwordHash,
        name: input.name,
        email: input.email,
      });
      return { success: true, userId: user?.id } as const;
    }),

  /** 修改当前登录用户的密码 */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, "新密码至少 8 个字符"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await db.getUserByOpenId(ctx.user.openId);
      if (!user?.passwordHash) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该账号未设置密码" });
      }
      const valid = await verifyPassword(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "当前密码错误" });
      }
      const newHash = await hashPassword(input.newPassword);
      await db.updateUserPassword(user.id, newHash);
      return { success: true } as const;
    }),

  }),


  // Dashboard
  dashboard: router({
    overview: adminProcedure.query(async () => {
      return await db.getDashboardOverview();
    }),
    userStats: adminProcedure.query(async () => {
      return await db.getWxUserStats();
    }),
    articleStats: adminProcedure.query(async () => {
      return await db.getWxArticleStats();
    }),
    activityStats: adminProcedure.query(async () => {
      return await db.getWxActivityStats();
    }),
  }),

  // WxUsers Management
wxUsers: router({
    list: adminProcedure
      .input(paginationInput.extend({ search: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getWxUsers(input);
      }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const user = await db.getWxUserById(input.id);
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
        return user;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        originalNick: z.string().optional(),
        originalSlogan: z.string().optional(),
        administrator: z.boolean().optional(),
        goldCoin: z.number().optional(),
        silverCoin: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateWxUser(id, data);
        const user = await db.getWxUserById(id);
        if (user?.wxId) {
          // 将本地字段名映射回微信云字段名
          const wxData: Record<string, unknown> = {};
          if (data.originalNick !== undefined) wxData.originalNick = data.originalNick;
          if (data.originalSlogan !== undefined) wxData.originalSlogan = data.originalSlogan;
          if (data.administrator !== undefined) wxData.administrator = data.administrator;
          if (data.goldCoin !== undefined) wxData.like_count = data.goldCoin;
          if (data.silverCoin !== undefined) wxData.silver_coin = data.silverCoin;
          try {
            await updateDocument("Users", user.wxId, wxData);
          } catch (e: unknown) {
            // 微信云写回失败不影响本地操作，记录警告日志
            await db.createSystemLog({ level: "warn", module: "wxUsers", action: "wx_sync", message: `微信云同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "info", module: "wxUsers", action: "update", message: `更新用户 #${id}`, userId: ctx.user.id });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getWxUserById(input.id);
        await db.deleteWxUser(input.id);
        if (user?.wxId) {
          try {
            await deleteDocument("Users", user.wxId);
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxUsers", action: "wx_sync", message: `微信云删除同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "warn", module: "wxUsers", action: "delete", message: `删除用户 #${input.id}`, userId: ctx.user.id });
        return { success: true };
      }),
    stats: adminProcedure.query(async () => {
      return await db.getWxUserStats();
    }),
  }),

  // WxArticles Management
  wxArticles: router({
    list: adminProcedure
      .input(paginationInput.extend({ search: z.string().optional(), status: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getWxArticles(input);
      }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const article = await db.getWxArticleById(input.id);
        if (!article) throw new TRPCError({ code: "NOT_FOUND", message: "文章不存在" });
        return article;
      }),
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWxArticle(input.id, { status: "approved", statusMessage: "", statusMessageDetail: "" });
        const article = await db.getWxArticleById(input.id);
        if (article?.wxId) {
          try {
            // 微信云中 status: true 表示审核通过
            await updateDocument("Article", article.wxId, { status: true, statusMessage: "", statusMessageDetail: "" });
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxArticles", action: "wx_sync", message: `微信云同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "info", module: "wxArticles", action: "approve", message: `审核通过文章 #${input.id}`, userId: ctx.user.id });
        return { success: true };
      }),
    reject: adminProcedure
      .input(z.object({ id: z.number(), reason: z.string().min(1).max(255) }))
      .mutation(async ({ input, ctx }) => {
        await db.updateWxArticle(input.id, { status: "rejected", statusMessage: "审核不通过", statusMessageDetail: input.reason });
        const article = await db.getWxArticleById(input.id);
        if (article?.wxId) {
          try {
            // 微信云中 status: false 表示审核不通过
            await updateDocument("Article", article.wxId, { status: false, statusMessage: "审核不通过", statusMessageDetail: input.reason });
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxArticles", action: "wx_sync", message: `微信云同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "info", module: "wxArticles", action: "reject", message: `拒绝文章 #${input.id}: ${input.reason}`, userId: ctx.user.id });
        return { success: true };
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        summary: z.string().optional(),
        content: z.string().optional(),
        status: z.enum(["pending", "approved", "rejected", "offline"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateWxArticle(id, data);
        const article = await db.getWxArticleById(id);
        if (article?.wxId) {
          try {
            const wxData: Record<string, unknown> = {};
            if (data.title !== undefined) wxData.title = data.title;
            if (data.summary !== undefined) wxData.summary = data.summary;
            if (data.content !== undefined) wxData.content = data.content;
            if (data.status !== undefined) {
              // 本地枚举 → 微信云 boolean/null
              wxData.status = data.status === "approved" ? true : data.status === "rejected" ? false : null;
            }
            if (Object.keys(wxData).length > 0) {
              await updateDocument("Article", article.wxId, wxData);
            }
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxArticles", action: "wx_sync", message: `微信云同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "info", module: "wxArticles", action: "update", message: `更新文章 #${id}`, userId: ctx.user.id });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const article = await db.getWxArticleById(input.id);
        await db.deleteWxArticle(input.id);
        if (article?.wxId) {
          try {
            await deleteDocument("Article", article.wxId);
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxArticles", action: "wx_sync", message: `微信云删除同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "warn", module: "wxArticles", action: "delete", message: `删除文章 #${input.id}`, userId: ctx.user.id });
        return { success: true };
      }),
    stats: adminProcedure.query(async () => {
      return await db.getWxArticleStats();
    }),
  }),

  // WxActivities Management
  wxActivities: router({
    list: adminProcedure
      .input(paginationInput.extend({ status: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getWxActivities(input);
      }),
    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const activity = await db.getWxActivityById(input.id);
        if (!activity) throw new TRPCError({ code: "NOT_FOUND", message: "活动不存在" });
        return activity;
      }),
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        describe: z.string().optional(),
        status: z.enum(["pending", "active", "ended"]).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await db.updateWxActivity(id, data);
        const activity = await db.getWxActivityById(id);
        if (activity?.wxId) {
          try {
            const wxData: Record<string, unknown> = {};
            if (data.name !== undefined) wxData.name = data.name;
            if (data.describe !== undefined) wxData.describe = data.describe;
            if (data.status !== undefined) {
              // 本地枚举 → 微信云 boolean/null
              wxData.status = data.status === "active" ? true : data.status === "ended" ? false : null;
            }
            if (Object.keys(wxData).length > 0) {
              await updateDocument("Active", activity.wxId, wxData);
            }
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxActivities", action: "wx_sync", message: `微信云同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "info", module: "wxActivities", action: "update", message: `更新活动 #${id}`, userId: ctx.user.id });
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const activity = await db.getWxActivityById(input.id);
        await db.deleteWxActivity(input.id);
        if (activity?.wxId) {
          try {
            await deleteDocument("Active", activity.wxId);
          } catch (e: unknown) {
            await db.createSystemLog({ level: "warn", module: "wxActivities", action: "wx_sync", message: `微信云删除同步失败: ${e instanceof Error ? e.message : String(e)}`, userId: ctx.user.id });
          }
        }
        await db.createSystemLog({ level: "warn", module: "wxActivities", action: "delete", message: `删除活动 #${input.id}`, userId: ctx.user.id });
        return { success: true };
      }),
    stats: adminProcedure.query(async () => {
      return await db.getWxActivityStats();
    }),
  }),

  // ETL / Data Sync

  sync: router({
    logs: adminProcedure
      .input(paginationInput.extend({ collection: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getSyncLogs(input);
      }),
    triggerSync: adminProcedure
      .input(z.object({ collection: z.enum(["Users", "Article", "Active", "songGoMessage", "all"]) }))
      .mutation(async ({ input, ctx }) => {
        const collections = input.collection === "all"
          ? ["Users", "Article", "Active", "songGoMessage"]
          : [input.collection];

        const results = [];
        for (const col of collections) {
          const logId = await db.createSyncLog({
            collection: col,
            action: "manual_sync",
            status: "running",
            totalRecords: 0,
            syncedRecords: 0,
            failedRecords: 0,
          });

          // 从微信云数据库拉取数据并写入本地 MySQL
          const startTime = Date.now();
          const result = await syncCollection(col);
          const duration = Date.now() - startTime;
          if (result.status === "success") {
            if (logId) {
              await db.updateSyncLog(logId, {
                status: "success",
                totalRecords: result.records ?? 0,
                syncedRecords: result.records ?? 0,
                failedRecords: 0,
                completedAt: new Date(),
                duration,
              });
            }
            results.push({ collection: col, status: "success", records: result.records ?? 0 });
            await db.createSystemLog({
              level: "info", module: "sync", action: "manual_sync",
              message: `同步 ${col} 完成，共 ${result.records ?? 0} 条记录`,
              userId: ctx.user.id,
            });
          } else {
            if (logId) {
              await db.updateSyncLog(logId, {
                status: "failed",
                errorMessage: result.error,
                completedAt: new Date(),
                duration,
              });
            }
            results.push({ collection: col, status: "failed", error: result.error });
            await db.createSystemLog({
              level: "error", module: "sync", action: "manual_sync",
              message: `同步 ${col} 失败: ${result.error}`,
              userId: ctx.user.id,
            });
          }
        }



        return { results };
      }),
  }),

  // System Logs

  systemLogs: router({
    list: adminProcedure
      .input(paginationInput.extend({ level: z.string().optional(), module: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getSystemLogs(input);
      }),
  }),


  // LLM Analysis
  analysis: router({
    reports: adminProcedure
      .input(paginationInput.extend({ type: z.string().optional() }))
      .query(async ({ input }) => {
        return await db.getAnalysisReports(input);
      }),
    generate: adminProcedure
      .input(z.object({ type: z.enum(["user_behavior", "content_trend", "operation_suggestion"]) }))
      .mutation(async ({ input, ctx }) => {
        // Gather data for analysis
        const [userStats, articleStats, activityStats, overview] = await Promise.all([
          db.getWxUserStats(),
          db.getWxArticleStats(),
          db.getWxActivityStats(),
          db.getDashboardOverview(),
        ]);

        const dataSnapshot = { userStats, articleStats, activityStats, overview };

        const typeLabels: Record<string, string> = {
          user_behavior: "用户行为分析",
          content_trend: "内容趋势分析",
          operation_suggestion: "运营建议",
        };

        const prompts: Record<string, string> = {
          user_behavior: `请分析以下微信小程序用户数据，生成用户行为分析报告：
- 总用户数：${userStats.total}
- 管理员数：${userStats.admins}
- 近7天活跃用户：${userStats.recentActive}
- 月度增长趋势：${JSON.stringify(userStats.monthlyGrowth)}

请从用户增长趋势、活跃度、用户留存等维度进行分析，并给出具体的数据洞察和建议。使用中文回复，格式化为 Markdown。`,

          content_trend: `请分析以下微信小程序内容数据，生成内容趋势分析报告：
- 总文章数：${articleStats.total}
- 待审核：${articleStats.pending}
- 已通过：${articleStats.approved}
- 已拒绝：${articleStats.rejected}
- 月度发布趋势：${JSON.stringify(articleStats.monthlyPublish)}

请从内容产出效率、审核效率、内容质量等维度进行分析，并给出具体的数据洞察和建议。使用中文回复，格式化为 Markdown。`,

          operation_suggestion: `请基于以下微信小程序运营数据，生成运营建议报告：
- 用户数据：总用户 ${userStats.total}，活跃用户 ${userStats.recentActive}
- 内容数据：总文章 ${articleStats.total}，待审核 ${articleStats.pending}
- 活动数据：总活动 ${activityStats.total}，进行中 ${activityStats.active}，待开始 ${activityStats.pending}
- 今日新增用户：${overview.todayNewUsers}

请从用户增长策略、内容运营优化、活动策划建议、数据驱动决策等维度给出具体可执行的运营建议。使用中文回复，格式化为 Markdown。`,
        };

        try {
          const response = await invokeLLM({
            messages: [
              { role: "system", content: "你是一个专业的数据分析师和运营顾问，擅长分析微信小程序的用户行为数据和内容趋势，能够给出有价值的数据洞察和运营建议。" },
              { role: "user", content: prompts[input.type] },
            ],
          });

          const content = typeof response.choices[0]?.message?.content === "string"
            ? response.choices[0].message.content
            : "";

          // Extract first line as summary
          const lines = content.split("\n").filter((l) => l.trim());
          const summary = lines[0]?.replace(/^#+\s*/, "").slice(0, 200) || typeLabels[input.type];

          await db.createAnalysisReport({
            type: input.type,
            title: `${typeLabels[input.type]} - ${new Date().toLocaleDateString("zh-CN")}`,
            content,
            summary,
            dataSnapshot,
          });

          await db.createSystemLog({
            level: "info", module: "analysis", action: "generate",
            message: `生成${typeLabels[input.type]}报告`, userId: ctx.user.id,
          });

          return { success: true, content, summary };
        } catch (error: any) {
          await db.createSystemLog({
            level: "error", module: "analysis", action: "generate",
            message: `生成分析报告失败: ${error.message}`, userId: ctx.user.id,
          });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `分析报告生成失败: ${error.message}` });
        }
      }),
  }),

  // 可视化大屏专用路由 (DataScreen)
  screen: router({
    kpi: adminProcedure.query(async () => db.getScreenKpi()),
    deviceStats: adminProcedure.query(async () => db.getScreenDeviceStats()),
    userGrowth: adminProcedure.query(async () => db.getScreenUserGrowth()),
    aiActivity: adminProcedure.query(async () => db.getScreenAiActivity()),
    articleBubble: adminProcedure.query(async () => db.getScreenArticleBubble()),
    coinsFeed: adminProcedure.query(async () => db.getScreenCoinsFeed()),
    topArticles: adminProcedure.query(async () => db.getScreenTopArticles()),
    activities: adminProcedure.query(async () => db.getScreenActivities()),
  }),
});

export type AppRouter = typeof appRouter;
