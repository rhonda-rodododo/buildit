#!/usr/bin/env python3
"""
Fix TypeScript errors automatically
Handles: unused imports, unused variables, possibly undefined checks
"""

import re
import sys
from pathlib import Path

def fix_unused_imports(content, unused_list):
    """Remove unused imports from import statements"""
    for unused in unused_list:
        # Remove from named imports
        content = re.sub(rf',\s*{unused}\s*,', ',', content)
        content = re.sub(rf'{{\s*{unused}\s*,', '{', content)
        content = re.sub(rf',\s*{unused}\s*}}', '}', content)
        content = re.sub(rf'{{\s*{unused}\s*}}', '', content)
        # Remove entire import line if empty
        content = re.sub(r"import\s*{\s*}\s*from\s*['\"].*['\"];?\n", '', content)
        content = re.sub(r"import\s*{\s*}\s*from\s*['\"].*['\"];\n", '', content)
    return content

def prefix_unused_params(content):
    """Prefix unused parameters with underscore"""
    # Fix: (item, index) => where index is unused
    content = re.sub(r'(\([^)]*,\s*)(index)(\s*\))', r'\1_index\3', content)
    content = re.sub(r'(\([^)]*,\s*)(key)(\s*\))', r'\1_key\3', content)
    # Also fix unused first params in arrow functions that aren't used
    return content

def add_null_checks(content, line_patterns):
    """Add optional chaining for possibly undefined"""
    # This is conservative - only add ?. for common database patterns
    content = re.sub(r'db\.([a-zA-Z]+)\.bulkAdd', r'db.\1?.bulkAdd', content)
    content = re.sub(r'db\.([a-zA-Z]+)\.add', r'db.\1?.add', content)
    return content

def main():
    # Read error log
    with open('/tmp/ts-errors.log', 'r') as f:
        errors = f.readlines()

    # Group errors by file
    file_errors = {}
    for error in errors:
        match = re.match(r'(src/[^(]+)\((\d+),\d+\): error (TS\d+): (.+)', error)
        if match:
            filepath, line, code, msg = match.groups()
            if filepath not in file_errors:
                file_errors[filepath] = []
            file_errors[filepath].append((line, code, msg))

    # Fix each file
    for filepath, errors_list in file_errors.items():
        path = Path('/workspace/buildit') / filepath
        if not path.exists():
            continue

        with open(path, 'r') as f:
            content = f.read()

        original = content

        # Extract unused variable names
        unused_vars = []
        for line, code, msg in errors_list:
            if code == 'TS6133':
                match = re.search(r"'([^']+)' is declared but", msg)
                if match:
                    unused_vars.append(match.group(1))

        # Apply fixes
        if unused_vars:
            content = fix_unused_imports(content, unused_vars)
            content = prefix_unused_params(content)

        # Add null checks for TS18048
        has_undefined_errors = any(code == 'TS18048' for _, code, _ in errors_list)
        if has_undefined_errors:
            content = add_null_checks(content, errors_list)

        # Write back if changed
        if content != original:
            with open(path, 'w') as f:
                f.write(content)
            print(f"Fixed: {filepath}")

if __name__ == '__main__':
    main()
