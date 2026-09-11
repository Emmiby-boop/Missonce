const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 配置
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  cloudFunctionsDir: path.resolve(__dirname, '../cloudfunctions'),
  outputFile: path.resolve(__dirname, '../security-report.json'),
  scanExtensions: ['.js', '.json', '.wxml', '.wxss'],
  ignoreDirs: ['node_modules', '.git', 'dist', 'miniprogram_npm'],
  sensitivePatterns: [
    { name: 'Hardcoded API Key', regex: /["'](sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35})["']/, risk: 'High', cve: 'CWE-798' },
    { name: 'Hardcoded Secret', regex: /["'](secret|password|passwd|pwd)["']\s*[:=]\s*["'][^"']{6,}["']/, risk: 'High', cve: 'CWE-798' },
    { name: 'Weak Randomness', regex: /Math\.random\(\)/, risk: 'Low', cve: 'CWE-330' },
    { name: 'Console Log', regex: /console\.log\(/, risk: 'Info', cve: 'CWE-532' }
  ]
};

// 结果存储
const report = {
  timestamp: new Date().toISOString(),
  stats: { filesScanned: 0, vulnerabilities: 0 },
  findings: []
};

// 递归扫描文件
function scanDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (CONFIG.ignoreDirs.includes(file)) return;
    
    if (stat.isDirectory()) {
      scanDir(filePath);
    } else if (CONFIG.scanExtensions.includes(path.extname(file))) {
      scanFile(filePath);
    }
  });
}

// 扫描单个文件
function scanFile(filePath) {
  report.stats.filesScanned++;
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(CONFIG.rootDir, filePath);
  
  // 1. 敏感模式匹配
  CONFIG.sensitivePatterns.forEach(pattern => {
    const match = content.match(pattern.regex);
    if (match) {
      addFinding({
        type: 'Source Code Analysis',
        vuln: pattern.name,
        risk: pattern.risk,
        file: relativePath,
        cve: pattern.cve,
        evidence: match[0].substring(0, 50) + '...',
        remediation: 'Move secrets to environment variables or CloudBase config.'
      });
    }
  });

  // 2. 依赖检查 (针对 package.json)
  if (path.basename(filePath) === 'package.json') {
    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // 示例：检查旧版 wx-server-sdk (模拟逻辑)
      if (deps['wx-server-sdk'] && deps['wx-server-sdk'] !== 'latest') {
        addFinding({
          type: 'Dependency Check',
          vuln: 'Outdated SDK',
          risk: 'Medium',
          file: relativePath,
          cve: 'N/A',
          evidence: `wx-server-sdk: ${deps['wx-server-sdk']}`,
          remediation: 'Update to latest version.'
        });
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }
}

function addFinding(finding) {
  report.stats.vulnerabilities++;
  report.findings.push(finding);
}

// 执行扫描
console.log('Starting security scan...');
const startTime = Date.now();

try {
  scanDir(CONFIG.rootDir);
  
  const duration = (Date.now() - startTime) / 1000;
  report.metadata = {
    duration: `${duration}s`,
    nodeVersion: process.version,
    memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
  };

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(report, null, 2));
  console.log(`Scan complete. Report saved to ${CONFIG.outputFile}`);
  console.log(`Found ${report.stats.vulnerabilities} issues in ${report.stats.filesScanned} files.`);
  
} catch (error) {
  console.error('Scan failed:', error);
  process.exit(1);
}
