#!/usr/bin/env python3
"""Apply minimal compile fixes to legacy Flutter screens before CI build."""
from pathlib import Path
import sys

root = Path(sys.argv[1])
def replace(path, old, new, label):
    p = root / path
    s = p.read_text()
    count = s.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    p.write_text(s.replace(old, new, 1))
    print(f"Patched {label}")

replace(
    "lib/screens/premium_membership_screen.dart",
    "Secure payment verification.",
    "Secure payment verification.",
    "premium placeholder",
) if False else None

# Close the outer Card/ Padding nesting before the following plan heading.
replace(
    "lib/screens/premium_membership_screen.dart",
    "वेबहुक प्राप्त होगा। केवल पेमेंट सक्सेस स्क्रीन से एक्सेस नहीं मिलेगा।'))),const SizedBox(height:22)",
    "वेबहुक प्राप्त होगा। केवल पेमेंट सक्सेस स्क्रीन से एक्सेस नहीं मिलेगा।'))]))),const SizedBox(height:22)",
    "premium membership widget nesting",
)

# Close Card after ListTile in each mapped learning-plan task.
replace(
    "lib/screens/ai_study_mentor_screen.dart",
    "${item['status']}')); }),",
    "${item['status']}'))); }),",
    "AI study-plan task card",
)

# Supabase query builders are awaitable but are not typed as Future by Future.wait.
replace(
    "lib/screens/profile_screen.dart",
    "final results = await Future.wait([\n        db.from('profiles').select().eq('id', user.id).maybeSingle(),\n        db.rpc('get_my_membership'),\n      ]);",
    "final results = await Future.wait<dynamic>([\n        db.from('profiles').select().eq('id', user.id).maybeSingle().then((value) => value),\n        db.rpc('get_my_membership').then((value) => value),\n      ]);",
    "profile parallel data loading types",
)

replace(
    "lib/screens/syllabus_tracker_screen.dart",
    "LinearProgressIndicator(value:pct)",
    "LinearProgressIndicator(value:pct.toDouble())",
    "syllabus progress numeric type",
)

# Keep patch matching explicit to the current bundled mobile source revision.
