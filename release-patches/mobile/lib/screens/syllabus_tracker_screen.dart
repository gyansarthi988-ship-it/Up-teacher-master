import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class SyllabusTrackerScreen extends StatefulWidget {
  final String language;
  const SyllabusTrackerScreen({super.key, this.language = 'en'});
  @override
  State<SyllabusTrackerScreen> createState() => _SyllabusTrackerScreenState();
}
class _SyllabusTrackerScreenState extends State<SyllabusTrackerScreen> {
  final db = Supabase.instance.client;
  bool loading = true;
  String? error;
  List<Map<String,dynamic>> exams = [], items = [];
  Map<String,Map<String,dynamic>> progress = {};
  String? examId;
  bool get hi => widget.language == 'hi';
  String t(String h,String e)=>hi?h:e;
  @override void initState(){super.initState(); load();}
  Future<void> load() async {
    setState(()=>loading=true); error=null;
    try {
      exams=(await db.from('exams').select('id,code,name_en,name_hi')
        .eq('is_active',true).order('display_order')).map((e)=>Map<String,dynamic>.from(e)).toList();
      if(exams.isNotEmpty) {
        examId ??= exams.first['id'] as String;
        final raw=await db.from('syllabus_items').select('id,topic_id,weightage,topics!inner(id,name_en,name_hi,chapters!inner(id,name_en,name_hi,subjects!inner(id,name_en,name_hi)))')
          .eq('exam_id',examId!).eq('is_active',true);
        items=raw.map((e)=>Map<String,dynamic>.from(e)).toList();
        final p=await db.from('user_topic_progress').select('syllabus_item_id,status,confidence')
          .eq('user_id',db.auth.currentUser!.id);
        progress={for(final x in p) x['syllabus_item_id'] as String:Map<String,dynamic>.from(x)};
      }
    } catch(e) { error=t('सिलेबस लोड नहीं हो पाया।','Could not load syllabus. Check that migration 0017 is applied and syllabus content is published.'); }
    if(mounted)setState(()=>loading=false);
  }
  String name(Map<String,dynamic> x,String en,String hn)=>((hi?x[hn]:x[en])??x[en]??'').toString();
  Future<void> setStatus(String id,String status) async {
    final row={'user_id':db.auth.currentUser!.id,'syllabus_item_id':id,'status':status,'updated_at':DateTime.now().toUtc().toIso8601String()};
    try {
      await db.from('user_topic_progress').upsert(row,onConflict:'user_id,syllabus_item_id');
      progress[id]={...row};
      if(mounted)setState((){});
    } catch(_){if(mounted)ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(t('Progress save नहीं हुआ।','Could not save progress.'))));}
  }
  @override Widget build(BuildContext context){
    final done=items.where((x)=>(progress[x['id']]?['status'])=='completed').length;
    final double pct=items.isEmpty?0.0:done/items.length;
    return Scaffold(appBar:AppBar(title:Text(t('Syllabus Tracker','सिलेबस ट्रैकर')),actions:[IconButton(onPressed:load,icon:const Icon(Icons.refresh))]),
      body:loading?const Center(child:CircularProgressIndicator()):RefreshIndicator(onRefresh:load,child:ListView(padding:const EdgeInsets.all(14),children:[
        if(error!=null)Text(error!,style:const TextStyle(color:Colors.red)),
        DropdownButtonFormField<String>(value:examId,decoration:InputDecoration(labelText:t('अपनी परीक्षा चुनें','Select examination')),
          items:exams.map((e)=>DropdownMenuItem(value:e['id'] as String,child:Text(name(e,'name_en','name_hi')))).toList(),
          onChanged:(v){if(v!=null){examId=v;load();}}),
        const SizedBox(height:14),
        Card(child:Padding(padding:const EdgeInsets.all(16),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text(t('आपकी सिलेबस प्रगति','YOUR SYLLABUS PROGRESS'),style:const TextStyle(fontWeight:FontWeight.bold)),
          const SizedBox(height:8),LinearProgressIndicator(value:pct),
          const SizedBox(height:6),Text('$done / ${items.length} ${t('टॉपिक्स पूरे','topics completed')} • ${(pct*100).toStringAsFixed(1)}%')
        ]))),
        if(items.isEmpty)Padding(padding:const EdgeInsets.all(18),child:Text(t('इस परीक्षा का syllabus admin द्वारा अभी add नहीं किया गया है।','No syllabus topics have been published for this exam yet.'))),
        ...items.map((x){
          final topic=Map<String,dynamic>.from(x['topics'] as Map);
          final chapter=Map<String,dynamic>.from(topic['chapters'] as Map);
          final subject=Map<String,dynamic>.from(chapter['subjects'] as Map);
          final status=(progress[x['id']]?['status']??'not_started').toString();
          return Card(child:Padding(padding:const EdgeInsets.all(12),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text(name(subject,'name_en','name_hi'),style:TextStyle(color:Theme.of(context).colorScheme.primary,fontWeight:FontWeight.w600)),
            Text('${name(chapter,'name_en','name_hi')} • ${name(topic,'name_en','name_hi')}',style:const TextStyle(fontWeight:FontWeight.bold)),
            const SizedBox(height:8),
            DropdownButtonFormField<String>(value:status,decoration:InputDecoration(labelText:t('आपकी स्थिति','Your status'),isDense:true),
              items:[
                DropdownMenuItem(value:'not_started',child:Text(t('शुरू नहीं किया','Not started'))),
                DropdownMenuItem(value:'in_progress',child:Text(t('पढ़ रहे हैं','In progress'))),
                DropdownMenuItem(value:'completed',child:Text(t('पूरा हुआ','Completed'))),
                DropdownMenuItem(value:'revise',child:Text(t('दोबारा Revision','Revise again'))),
              ],onChanged:(v){if(v!=null)setStatus(x['id'] as String,v);})
          ])));
        })
      ])));
  }
}
