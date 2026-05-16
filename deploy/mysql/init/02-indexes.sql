
-- wx_users 索引
CREATE INDEX idx_wx_users_openid ON wx_users(openid);
CREATE INDEX idx_wx_users_administrator ON wx_users(administrator);
CREATE INDEX idx_wx_users_created_at ON wx_users(createdAt);
CREATE INDEX idx_wx_users_updated_at ON wx_users(updatedAt);

-- wx_articles 索引
CREATE INDEX idx_wx_articles_status ON wx_articles(status);
CREATE INDEX idx_wx_articles_author_id ON wx_articles(authorId);
CREATE INDEX idx_wx_articles_created_at ON wx_articles(createdAt);
CREATE INDEX idx_wx_articles_updated_at ON wx_articles(updatedAt);
CREATE FULLTEXT INDEX idx_wx_articles_title ON wx_articles(title);

-- wx_activities 索引
CREATE INDEX idx_wx_activities_status ON wx_activities(status);
CREATE INDEX idx_wx_activities_start_date ON wx_activities(startDate);
CREATE INDEX idx_wx_activities_end_date ON wx_activities(endDate);

-- sync_logs 索引
CREATE INDEX idx_sync_logs_collection ON sync_logs(collection);
CREATE INDEX idx_sync_logs_status ON sync_logs(status);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(startedAt);

-- system_logs 索引
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_module ON system_logs(module);
CREATE INDEX idx_system_logs_created_at ON system_logs(createdAt);

-- analysis_reports 索引
CREATE INDEX idx_analysis_reports_type ON analysis_reports(type);
CREATE INDEX idx_analysis_reports_generated_at ON analysis_reports(generatedAt);

-- wx_coins_transactions 索引
CREATE INDEX idx_wx_coins_sender ON wx_coins_transactions(senderId);
CREATE INDEX idx_wx_coins_receiver ON wx_coins_transactions(receiverId);
