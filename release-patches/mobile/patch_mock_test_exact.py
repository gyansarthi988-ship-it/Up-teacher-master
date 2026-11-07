from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text()
old="""      // Fetch only published questions. Template filters are applied before
      // the final question set is frozen; answer keys are never selected.
      final rows = await _db.from('questions').select('id,subject_id,topic_id,difficulty,question_hi,question_en,marks,negative_marks,question_options(id,option_key,text_hi,text_en,display_order)')
        .eq('exam_id', widget.examId).eq('status', 'published').limit(2000);
      final pool = (rows as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
      final config = widget.questionSelection ?? const <String, dynamic>{};
      final distribution = config['subject_distribution'];
      final difficulty = config['difficulty_distribution'];
      final List<Map<String, dynamic>> items = [];
"""
new="""      // Exact Excel assignments are authoritative when present. Templates
      // without assignment rows retain the existing random/distribution path.
      final List<Map<String, dynamic>> items = [];
      var hasExactAssignment = false;
      if (widget.templateId != null) {
        final assigned = await _db.from('mock_test_template_questions')
          .select('question_order,marks_override,negative_marks_override,questions!inner(id,exam_id,subject_id,topic_id,difficulty,status,question_hi,question_en,marks,negative_marks,question_options(id,option_key,text_hi,text_en,display_order))')
          .eq('template_id', widget.templateId!).order('question_order', ascending: true);
        final assignmentRows = (assigned as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        if (assignmentRows.isNotEmpty) {
          hasExactAssignment = true;
          for (final row in assignmentRows) {
            final q = Map<String, dynamic>.from(row['questions'] as Map);
            if (q['exam_id'].toString() != widget.examId || q['status'] != 'published') {
              throw Exception(t('इस टेस्ट में कोई प्रश्न प्रकाशित नहीं है या परीक्षा से मेल नहीं खाता।','An assigned question is unpublished or belongs to another exam.'));
            }
            if (row['marks_override'] != null) q['marks'] = row['marks_override'];
            if (row['negative_marks_override'] != null) q['negative_marks'] = row['negative_marks_override'];
            items.add(q);
          }
          if (items.length != widget.questionCount) {
            throw Exception(t('Excel में दिए गए प्रश्नों की संख्या टेस्ट से मेल नहीं खाती।','Excel-assigned question count does not match this test.'));
          }
        }
      }
      if (!hasExactAssignment) {
        final rows = await _db.from('questions').select('id,subject_id,topic_id,difficulty,question_hi,question_en,marks,negative_marks,question_options(id,option_key,text_hi,text_en,display_order)')
          .eq('exam_id', widget.examId).eq('status', 'published').limit(2000);
        final pool = (rows as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
        final config = widget.questionSelection ?? const <String, dynamic>{};
        final distribution = config['subject_distribution'];
        final difficulty = config['difficulty_distribution'];
"""
if old not in s: raise SystemExit("Mock Test selection start did not match; refusing patch")
s=s.replace(old,new,1)
old2="""      } else {
        items.addAll(pool..shuffle());
        if (items.length > widget.questionCount) items.removeRange(widget.questionCount, items.length);
      }
      if (items.length > widget.questionCount) items.removeRange(widget.questionCount, items.length);
      items.shuffle();
"""
new2="""        } else {
          items.addAll(pool..shuffle());
          if (items.length > widget.questionCount) items.removeRange(widget.questionCount, items.length);
        }
        if (items.length > widget.questionCount) items.removeRange(widget.questionCount, items.length);
        items.shuffle();
      }
"""
if old2 not in s: raise SystemExit("Mock Test selection end did not match; refusing patch")
s=s.replace(old2,new2,1)
old3="'p_mode': 'mock'});"
if old3 not in s: raise SystemExit("Mock Test submission call did not match; refusing patch")
s=s.replace(old3,"'p_mode': 'mock', 'p_template_id': widget.templateId});",1)
p.write_text(s)
print("Exact Excel question loading and template-aware submission patched.")
