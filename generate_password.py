#!/usr/bin/env python3
"""密码生成器 - 支持自定义长度和复杂度"""

import random
import string
import argparse
import os


def generate_password(length=16, use_upper=True, use_digits=True, use_symbols=True):
    """生成随机密码"""
    chars = string.ascii_lowercase
    if use_upper:
        chars += string.ascii_uppercase
    if use_digits:
        chars += string.digits
    if use_symbols:
        chars += string.punctuation
    
    return ''.join(random.choice(chars) for _ in range(length))


def main():
    parser = argparse.ArgumentParser(description='生成随机密码')
    parser.add_argument('-l', '--length', type=int, default=16, help='密码长度 (默认: 16)')
    parser.add_argument('--no-upper', action='store_true', help='不含大写字母')
    parser.add_argument('--no-digits', action='store_true', help='不含数字')
    parser.add_argument('--no-symbols', action='store_true', help='不含特殊符号')
    parser.add_argument('-n', '--count', type=int, default=1, help='生成数量 (默认: 1)')
    
    args = parser.parse_args()
    
    for i in range(args.count):
        pwd = generate_password(
            length=args.length,
            use_upper=not args.no_upper,
            use_digits=not args.no_digits,
            use_symbols=not args.no_symbols
        )
        print(f"密码 {i+1}: {pwd}")


if __name__ == '__main__':
    main()
