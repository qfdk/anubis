# Changelog

## [Unreleased]

### Added
- 系统状态服务模块，提供CPU、内存使用率等监控
- 新的REST API接口，支持获取系统状态和fail2ban信息
- JWT认证保护API接口
- 日志系统增强，包括详细错误记录和文件日志

### Changed
- 优化所有路由使用异步async/await模式
- 改进错误处理流程，提高应用稳定性
- 添加compression提高性能
- 改进会话管理并提高安全性

### Fixed
- 修复回调嵌套问题
- 修复同步文件操作造成的阻塞问题
- 优化fail2ban重载逻辑

## [0.0.0] - Initial Version

### Features
- fail2ban管理界面
- Jail管理功能（创建、编辑、删除）
- Filter管理功能（创建、编辑、删除）
- IP禁止/解封功能
- IP地理位置显示