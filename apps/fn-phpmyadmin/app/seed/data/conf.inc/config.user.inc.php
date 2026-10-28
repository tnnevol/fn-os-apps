<?php
/**
 * phpMyAdmin 用户自定义配置（随应用包提供的最小可用版本）。
 *
 * 该文件以单文件方式挂载到容器内 /etc/phpmyadmin/config.user.inc.php，
 * 因此必须事先存在，否则容器启动时挂载会失败。
 *
 * 数据库连接不在这里配置：登录信息由应用界面的「服务器」页填写，
 * 或通过该文件追加 $cfg['Servers'][...] 项。
 *
 * 示例（按需启用）：
 *   $cfg['Servers'][1]['host'] = '127.0.0.1';
 *   $cfg['Servers'][1]['port'] = '3306';
 *   $cfg['Servers'][1]['auth_type'] = 'cookie';
 */

// 允许导出大结果集，与 uploads.ini 的限制保持一致
$cfg['ExecTimeLimit'] = 600;
