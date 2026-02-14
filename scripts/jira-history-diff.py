#!/usr/bin/env python3

import json
import sys
import difflib
import re

# ANSI color codes
RED = '\033[31m'
GREEN = '\033[32m'
CYAN = '\033[36m'
YELLOW = '\033[33m'
RED_BG = '\033[41m'
GREEN_BG = '\033[42m'
RESET = '\033[0m'

if len(sys.argv) < 2:
    print("Usage: python jira-history-diff.py <jira-json-file>")
    sys.exit(1)

def highlight_word_diff(old_line, new_line):
    """Highlight word-level differences with background color"""
    old_words = re.split(r'(\s+)', old_line)
    new_words = re.split(r'(\s+)', new_line)
    
    matcher = difflib.SequenceMatcher(None, old_words, new_words)
    
    old_result = []
    new_result = []
    
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == 'equal':
            old_result.extend(old_words[i1:i2])
            new_result.extend(new_words[j1:j2])
        elif tag == 'replace':
            old_result.append(RED_BG + ''.join(old_words[i1:i2]) + RESET)
            new_result.append(GREEN_BG + ''.join(new_words[j1:j2]) + RESET)
        elif tag == 'delete':
            old_result.append(RED_BG + ''.join(old_words[i1:i2]) + RESET)
        elif tag == 'insert':
            new_result.append(GREEN_BG + ''.join(new_words[j1:j2]) + RESET)
    
    return ''.join(old_result), ''.join(new_result)

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)

# Support both .json (full ticket) and .history.json (changelog only)
if 'changelog' in data:
    changelog = data['changelog']
else:
    changelog = data

for history in changelog['histories']:
    for item in history['items']:
        if item['field'] in ['description', 'summary']:
            print(f"\n{CYAN}=== {history['created']} by {history['author']['displayName']} ==={RESET}")
            print(f"{YELLOW}Field: {item['field']}{RESET}")
            
            from_str = item.get('fromString', '')
            to_str = item.get('toString', '')
            
            if from_str:
                from_lines = from_str.split('\n')
                to_lines = to_str.split('\n')
                
                matcher = difflib.SequenceMatcher(None, from_lines, to_lines)
                
                for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                    if tag == 'equal':
                        continue
                    elif tag == 'replace':
                        for i in range(i1, i2):
                            for j in range(j1, j2):
                                if i - i1 == j - j1:
                                    old_hl, new_hl = highlight_word_diff(from_lines[i], to_lines[j])
                                    print(f"{RED}- {old_hl}{RESET}")
                                    print(f"{GREEN}+ {new_hl}{RESET}")
                    elif tag == 'delete':
                        for i in range(i1, i2):
                            print(f"{RED}- {from_lines[i]}{RESET}")
                    elif tag == 'insert':
                        for j in range(j1, j2):
                            print(f"{GREEN}+ {to_lines[j]}{RESET}")
            else:
                for line in to_str.split('\n'):
                    print(f"{GREEN}+ {line}{RESET}")
            print()
