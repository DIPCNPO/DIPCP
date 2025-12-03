#!/usr/bin/env python3
"""
开发服务器 - 禁用缓存
"""
import http.server
import socketserver
import os
import sys
from urllib.parse import urlparse

class NoCacheHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # 添加禁用缓存的HTTP头
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        # 允许跨域
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_GET(self):
        original_path = self.path
        
        # 处理 /DIPCP 路径
        if self.path.startswith('/DIPCP'):
            # 移除 /DIPCP 前缀
            self.path = self.path[6:]  # 6 = len('/DIPCP')
            # 如果路径为空，设置为 /index.html
            if not self.path or self.path == '/':
                self.path = '/index.html'
        else:
            # 根路径重定向到 /DIPCP
            if self.path == '/':
                self.send_response(302)
                self.send_header('Location', '/DIPCP/')
                self.end_headers()
                return
            # 其他路径返回404（因为不是DIPCP路径）
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b'404 Not Found')
                return
        
        # 为JS和CSS文件添加版本参数
        if self.path.endswith(('.js', '.css')):
            parsed_path = urlparse(self.path)
            if '?' not in self.path:
                file_path = 'DIPCP' + self.path if self.path.startswith('/') else 'DIPCP/' + self.path
                self.path = self.path + '?v=' + str(int(os.path.getmtime(file_path) if os.path.exists(file_path) else 0))
        
        # SPA路由支持 - 所有非文件请求都重定向到index.html
        if not self.path.startswith('/js/') and not self.path.startswith('/styles/') and not self.path.startswith('/locales/') and not self.path.endswith(('.js', '.css', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico')):
            # 检查是否是文件请求
            file_path = 'DIPCP' + (self.path if self.path.startswith('/') else '/' + self.path)
            if not os.path.exists(file_path) or os.path.isdir(file_path):
                # 不是文件或文件不存在，重定向到index.html
                self.path = '/index.html'
        
        super().do_GET()
    
    def translate_path(self, path):
        # 将所有路径映射到DIPCP目录
        path = super().translate_path(path)
        # path现在是一个完整路径，我们需要替换掉docroot，加上DIPCP前缀
        # SimpleHTTPRequestHandler默认的docroot是os.getcwd()
        cwd = os.getcwd()
        if path.startswith(cwd):
            # 替换当前目录为DIPCP子目录
            path = os.path.join(cwd, 'DIPCP', path[len(cwd):].lstrip(os.sep))
        else:
            # 如果路径不在cwd下，直接添加DIPCP前缀
            path = os.path.join(cwd, 'DIPCP', path.lstrip(os.sep))
        return path

if __name__ == "__main__":
    PORT = 8000
    
    # 切换到BMAD根目录
    os.chdir(os.path.join(os.path.dirname(__file__)))
    
    with socketserver.ThreadingTCPServer(("", PORT), NoCacheHTTPRequestHandler) as httpd:
        print(f"开发服务器启动在 http://localhost:{PORT}")
        print("缓存已禁用，文件修改会自动刷新")
        print("按 Ctrl+C 停止服务器")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务器已停止")
            sys.exit(0)
