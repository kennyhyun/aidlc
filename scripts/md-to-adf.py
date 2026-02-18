#!/usr/bin/env python3
"""
Convert simplified markdown to Atlassian Document Format (ADF)
"""

import sys
import json
import re

def parse_markdown_to_adf(md_text):
    """Convert markdown text to ADF structure"""
    lines = md_text.strip().split('\n')
    content = []
    current_bullet_list = None
    current_ordered_list = None
    in_success_criteria = False
    current_task_section = None
    task_lists = {}  # Store task lists by section name
    
    i = 0
    while i < len(lines):
        line = lines[i]
        
        # Skip empty lines
        if not line.strip():
            # Don't add empty paragraphs, just continue
            # This will naturally break bullet/ordered lists
            if current_bullet_list:
                content.append(current_bullet_list)
                current_bullet_list = None
            if current_ordered_list:
                content.append(current_ordered_list)
                current_ordered_list = None
            
            i += 1
            continue
        
        # Headings
        if line.startswith('### '):
            # Flush any pending lists
            if current_bullet_list:
                content.append(current_bullet_list)
                current_bullet_list = None
            if current_ordered_list:
                content.append(current_ordered_list)
                current_ordered_list = None
            
            # Flush any pending task list
            if current_task_section and current_task_section in task_lists:
                content.append(task_lists[current_task_section])
                current_task_section = None
            
            heading_text = line[4:]
            
            # Check if this is Success Criteria section
            if 'Success Criteria' in heading_text:
                in_success_criteria = True
            else:
                in_success_criteria = False
            
            content.append({
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": heading_text}]
            })
            i += 1
            continue
            
        elif line.startswith('## '):
            # Flush any pending lists
            if current_bullet_list:
                content.append(current_bullet_list)
                current_bullet_list = None
            if current_ordered_list:
                content.append(current_ordered_list)
                current_ordered_list = None
            
            # Flush any pending task list
            if current_task_section and current_task_section in task_lists:
                content.append(task_lists[current_task_section])
                current_task_section = None
            
            in_success_criteria = False
            
            content.append({
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": line[3:]}]
            })
            i += 1
            continue
            
        elif line.startswith('# '):
            # Flush any pending lists
            if current_bullet_list:
                content.append(current_bullet_list)
                current_bullet_list = None
            if current_ordered_list:
                content.append(current_ordered_list)
                current_ordered_list = None
            
            # Flush any pending task list
            if current_task_section and current_task_section in task_lists:
                content.append(task_lists[current_task_section])
                current_task_section = None
            
            in_success_criteria = False
            
            content.append({
                "type": "heading",
                "attrs": {"level": 1},
                "content": [{"type": "text", "text": line[2:]}]
            })
            i += 1
            continue
        
        # Check if this is a section label within success criteria (like "Build and Packaging:")
        if in_success_criteria and line.endswith(':') and not line.startswith(' ') and not line.startswith('-'):
            # Flush previous task list if any
            if current_task_section and current_task_section in task_lists:
                content.append(task_lists[current_task_section])
            
            # This is a new subsection
            current_task_section = line[:-1]  # Remove the colon
            
            # Add the section label as a paragraph
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": line}]
            })
            
            # Initialize task list for this section
            task_lists[current_task_section] = {
                "type": "taskList",
                "attrs": {"localId": f"criteria-{current_task_section.lower().replace(' ', '-').replace('/', '-')}"},
                "content": []
            }
            
            i += 1
            continue
        
        # Bullet lists (support standard markdown: -, *, +)
        if line.startswith('- ') or line.startswith('* ') or line.startswith('+ ') or line.startswith('• '):
            text = line[2:].strip()
            inline_content = parse_inline(text)
            
            # If in success criteria section with a current section, add as task item
            if in_success_criteria and current_task_section:
                task_lists[current_task_section]["content"].append({
                    "type": "taskItem",
                    "attrs": {
                        "localId": f"task-{current_task_section.lower().replace(' ', '-').replace('/', '-')}-{len(task_lists[current_task_section]['content'])}",
                        "state": "TODO"
                    },
                    "content": inline_content
                })
            else:
                # Regular bullet list - keep adding to current list
                if current_ordered_list:
                    content.append(current_ordered_list)
                    current_ordered_list = None
                
                if not current_bullet_list:
                    current_bullet_list = {
                        "type": "bulletList",
                        "content": []
                    }
                
                current_bullet_list["content"].append({
                    "type": "listItem",
                    "content": [{
                        "type": "paragraph",
                        "content": inline_content
                    }]
                })
            
            i += 1
            continue
        
        # Numbered lists
        if re.match(r'^\d+\.\s', line):
            text = re.sub(r'^\d+\.\s', '', line)
            inline_content = parse_inline(text)
            
            if current_bullet_list:
                content.append(current_bullet_list)
                current_bullet_list = None
            
            if not current_ordered_list:
                current_ordered_list = {
                    "type": "orderedList",
                    "content": []
                }
            
            current_ordered_list["content"].append({
                "type": "listItem",
                "content": [{
                    "type": "paragraph",
                    "content": inline_content
                }]
            })
            
            i += 1
            continue
        
        # Indented items (sub-items) - handle multiple nesting levels
        # Support standard markdown bullet markers: -, *, +
        if (line.startswith('  - ') or line.startswith('  * ') or line.startswith('  + ') or
            line.startswith('    - ') or line.startswith('    * ') or line.startswith('    + ')):
            # Count indentation level (2 spaces = 1 level)
            indent_level = (len(line) - len(line.lstrip())) // 2
            text = line.strip()[2:]
            inline_content = parse_inline(text)
            
            # If we have a current bullet list, add as nested item
            if current_bullet_list and current_bullet_list["content"]:
                # Navigate to the correct nesting level
                target = current_bullet_list["content"][-1]
                
                # Go down to the appropriate nesting level
                for level in range(1, indent_level):
                    if len(target["content"]) > 1 and target["content"][-1]["type"] == "bulletList":
                        # Go deeper into existing nested list
                        nested_list = target["content"][-1]
                        if nested_list["content"]:
                            target = nested_list["content"][-1]
                        else:
                            break
                    else:
                        break
                
                # Add nested bulletList if needed
                if len(target["content"]) == 1 and target["content"][0]["type"] == "paragraph":
                    # First nested item - create bulletList
                    target["content"].append({
                        "type": "bulletList",
                        "content": [{
                            "type": "listItem",
                            "content": [{
                                "type": "paragraph",
                                "content": inline_content
                            }]
                        }]
                    })
                elif len(target["content"]) > 1 and target["content"][-1]["type"] == "bulletList":
                    # Add to existing nested bulletList
                    target["content"][-1]["content"].append({
                        "type": "listItem",
                        "content": [{
                            "type": "paragraph",
                            "content": inline_content
                        }]
                    })
            else:
                # No current list, treat as regular paragraph with indent
                if current_ordered_list:
                    content.append(current_ordered_list)
                    current_ordered_list = None
                
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": "  • "}] + inline_content
                })
            
            i += 1
            continue
        
        # Regular paragraph
        if current_bullet_list:
            content.append(current_bullet_list)
            current_bullet_list = None
        if current_ordered_list:
            content.append(current_ordered_list)
            current_ordered_list = None
        
        inline_content = parse_inline(line)
        content.append({
            "type": "paragraph",
            "content": inline_content
        })
        
        i += 1
    
    # Flush any remaining lists
    if current_bullet_list:
        content.append(current_bullet_list)
    if current_ordered_list:
        content.append(current_ordered_list)
    if current_task_section and current_task_section in task_lists:
        content.append(task_lists[current_task_section])
    
    return {
        "version": 1,
        "type": "doc",
        "content": content
    }

def parse_inline(text):
    """Parse inline formatting (code, bold, etc.)"""
    content = []
    pos = 0
    
    # Simple regex to find code blocks `text`
    pattern = r'`([^`]+)`'
    
    for match in re.finditer(pattern, text):
        # Add text before code
        if match.start() > pos:
            content.append({
                "type": "text",
                "text": text[pos:match.start()]
            })
        
        # Add code
        content.append({
            "type": "text",
            "text": match.group(1),
            "marks": [{"type": "code"}]
        })
        
        pos = match.end()
    
    # Add remaining text
    if pos < len(text):
        content.append({
            "type": "text",
            "text": text[pos:]
        })
    
    return content if content else [{"type": "text", "text": text}]

def main():
    if len(sys.argv) != 2:
        print("Usage: md-to-adf.py <markdown-file>")
        sys.exit(1)
    
    md_file = sys.argv[1]
    
    with open(md_file, 'r') as f:
        content = f.read()
    
    # Extract description section
    match = re.search(r'^## Description\s*\n(.*?)(?=^## |\Z)', content, re.MULTILINE | re.DOTALL)
    
    if not match:
        print("Error: No description section found", file=sys.stderr)
        sys.exit(1)
    
    description = match.group(1).strip()
    
    # Convert to ADF
    adf = parse_markdown_to_adf(description)
    
    # Output JSON
    print(json.dumps(adf, indent=2))

if __name__ == '__main__':
    main()
