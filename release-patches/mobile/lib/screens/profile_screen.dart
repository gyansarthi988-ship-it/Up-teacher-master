import '../notification_service.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'premium_membership_screen.dart';

class ProfileScreen extends StatefulWidget {
  final String language;
  const ProfileScreen({super.key, this.language = 'en'});
  @override State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final db = Supabase.instance.client;
  final name = TextEditingController();
  final phone = TextEditingController();
  bool loading = true, saving = false;
  Map<String, dynamic> profile = {};
  Map<String, dynamic> membership = {};
  bool get hi => widget.language == 'hi';
  String t(String en, String hindi) => hi ? hindi : en;

  @override void initState() { super.initState(); _load(); }
  @override void dispose() { name.dispose(); phone.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final user = db.auth.currentUser;
      if (user == null) return;
      final profileFuture = db.from('profiles').select().eq('id', user.id).maybeSingle();
      final membershipFuture = db.rpc('get_my_membership');
      final results = await Future.wait<dynamic>(<Future<dynamic>>[
        profileFuture,
        membershipFuture,
      ]);
      if (!mounted) return;
      profile = Map<String, dynamic>.from((results[0] as Map?) ?? {});
      membership = Map<String, dynamic>.from((results[1] as Map?) ?? {});
      name.text = '${profile['full_name'] ?? user.userMetadata?['full_name'] ?? ''}';
      phone.text = '${profile['phone'] ?? user.phone ?? ''}';
      setState(() => loading = false);
    } catch (e) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _save() async {
    final user = db.auth.currentUser;
    if (user == null || saving) return;
    setState(() => saving = true);
    try {
      await db.from('profiles').update({
        'full_name': name.text.trim(),
        'phone': phone.text.trim(),
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      }).eq('id', user.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('Profile updated.','प्रोफाइल अपडेट हो गई।'))));
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(t('Could not update profile. Please try again.','प्रोफाइल अपडेट नहीं हो सकी। दोबारा प्रयास करें।'))));
    } finally { if (mounted) setState(() => saving = false); }
  }

  @override Widget build(BuildContext context) {
    final user = db.auth.currentUser;
    final active = membership['is_premium'] == true;
    final sub = membership['subscription'] is Map ? Map<String,dynamic>.from(membership['subscription']) : <String,dynamic>{};
    final expiry = DateTime.tryParse('${sub['expires_at'] ?? ''}')?.toLocal();
    return Scaffold(
      appBar: AppBar(title: Text(t('My Profile','मेरी प्रोफाइल'))),
      body: loading ? const Center(child: CircularProgressIndicator()) : ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: Padding(padding: const EdgeInsets.all(18), child: Row(children: [
          const CircleAvatar(radius: 30, child: Icon(Icons.person, size: 34)), const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name.text.isEmpty ? t('UP Teacher Master User','UP Teacher Master उपयोगकर्ता') : name.text, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4), Text(user?.email ?? user?.phone ?? '', style: Theme.of(context).textTheme.bodySmall),
          ])),
        ]))),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t('Personal Details','व्यक्तिगत जानकारी'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12), TextField(controller: name, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: t('Full name','पूरा नाम'), border: const OutlineInputBorder())),
          const SizedBox(height: 12), TextField(controller: phone, keyboardType: TextInputType.phone, decoration: InputDecoration(labelText: t('Phone number','मोबाइल नंबर'), border: const OutlineInputBorder(), helperText: t('Changing this field does not change your login number.','यहाँ नंबर बदलने से लॉगिन नंबर नहीं बदलेगा।'))),
          const SizedBox(height: 14), SizedBox(width: double.infinity, child: FilledButton.icon(onPressed: saving ? null : _save, icon: const Icon(Icons.save), label: Text(saving ? t('Saving...','सेव हो रहा है...') : t('Save Profile','प्रोफाइल सेव करें')))),
        ]))),
        const SizedBox(height: 12),
        Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Icon(active ? Icons.workspace_premium : Icons.person_outline, color: active ? Colors.amber.shade800 : null), const SizedBox(width: 8), Expanded(child: Text(t('Membership Status','सदस्यता स्थिति'), style: Theme.of(context).textTheme.titleLarge))]),
          const SizedBox(height: 8), Text(active ? t('Premium Active','प्रीमियम सक्रिय') : t('Free Membership','फ्री सदस्यता'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 17)),
          if (active && expiry != null) Text('${t('Valid until','वैधता समाप्ति')}: ${expiry.toString().split('.').first}'),
          const SizedBox(height: 10), OutlinedButton.icon(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => PremiumMembershipScreen(language: widget.language))), icon: const Icon(Icons.workspace_premium), label: Text(t('Manage Membership & Purchase History','सदस्यता और खरीदारी का इतिहास देखें'))),
        ]))),
        const SizedBox(height: 12),
        Card(child: Column(children: [
          ListTile(leading: const Icon(Icons.verified_user_outlined), title: Text(t('Account security','अकाउंट सुरक्षा')), subtitle: Text(t('Your account is managed through secure sign-in.','आपका अकाउंट सुरक्षित साइन-इन से जुड़ा है।'))),
          const Divider(height: 1),
          ListTile(leading: const Icon(Icons.logout, color: Colors.red), title: Text(t('Sign out','लॉग आउट'), style: const TextStyle(color: Colors.red)), onTap: () async { await NotificationService.instance.unregisterCurrentDevice(); await db.auth.signOut(); if (mounted) Navigator.of(context).popUntil((r) => r.isFirst); }),
        ])),
        const SizedBox(height: 12), Text(t('Account ID','अकाउंट ID') + ': ${user?.id ?? '-'}', style: Theme.of(context).textTheme.bodySmall),
      ]),
    );
  }
}
