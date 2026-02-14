#!/usr/bin/env python3
"""Fix remaining TypeScript errors"""

import re
from pathlib import Path

fixes = {
    # Fix unused variables by prefixing with underscore
    'src/components/feed/ActivityFeed.tsx': [
        (r'isLoadingPosts', '_isLoadingPosts'),
        (r'isLoadingFeed: isLoadingPosts', 'isLoadingFeed: _isLoadingPosts'),
    ],
    'src/components/security/AuditLogs.tsx': [
        (r'const \[logs, setLogs\]', 'const [logs, _setLogs]'),
    ],
    'src/components/security/MemberVerification.tsx': [
        (r'const \[selectedMember, setSelectedMember\]', 'const [_selectedMember, _setSelectedMember]'),
        (r'const \[vouchInput, setVouchInput\]', 'const [_vouchInput, setVouchInput]'),
    ],
    'src/core/storage/db.ts': [
        (r'const schemaInitialized =', 'const _schemaInitialized ='),
        (r'for \(const \[moduleId, module\]', 'for (const [_moduleId, module]'),
        (r'for \(const \[moduleId, schema\]', 'for (const [_moduleId, _schema]'),
        (r'const target =', 'const _target ='),
    ],
    'src/pages/ContactDetailPage.tsx': [
        (r'const \[contact, setContact\]', 'const [contact, _setContact]'),
    ],
    'src/pages/PrivacyDemoPage.tsx': [
        (r'const \[riskLevel, setRiskLevel\]', 'const [_riskLevel, _setRiskLevel]'),
    ],
    # Fix 'index' variable name issue
    'src/components/analytics/CampaignAnalytics.tsx': [
        (r'\(contributor, _index\)', '(contributor, idx)'),
        (r'#\{index \+ 1\}', '#{idx + 1}'),
    ],
    # Fix lucide-react title prop
    'src/components/activity-log/ConversationHistory.tsx': [
        (r'<Lock className="w-4 h-4" title="Private"/>', '<Lock className="w-4 h-4" />'),
    ],
    'src/components/bulk-operations/TaskManager.tsx': [
        (r'<CheckCircle2 className="w-5 h-5 text-green-500" title="Completed"/>', '<CheckCircle2 className="w-5 h-5 text-green-500" />'),
    ],
    # Fix encryption.ts imports
    'src/core/storage/encryption.ts': [
        (r"import { useAuthStore } from '@/stores/authStore';", ''),
        (r'(key as any)\[field\] = ', 'key[field as keyof T] = '),
    ],
}

# Apply text replacements
for filepath, replacements in fixes.items():
    path = Path('/workspace/buildit') / filepath
    if not path.exists():
        print(f"Skip {filepath} (not found)")
        continue

    with open(path, 'r') as f:
        content = f.read()

    original = content
    for pattern, replacement in replacements:
        content = re.sub(pattern, replacement, content)

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f"Fixed: {filepath}")

print("Done!")
