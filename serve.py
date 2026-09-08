#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""life-vocab-app · 本地静态服务器 (禁用缓存)
用法:  python serve.py [port]
替代 python -m http.server: 增加 Cache-Control: no-store, 防止浏览器缓存旧版 index.html
"""
import os, sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8173

class NoCacheHandler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        # 禁用缓存: 每次请求都拿到磁盘上最新的文件
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # 精简日志
        sys.stderr.write('[%s] %s\n' % (self.address_string(), fmt % args))

if __name__ == '__main__':
    os.chdir(HERE)
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler)
    print(f'life-vocab-app server running at http://127.0.0.1:{PORT}/  (no-cache)')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
