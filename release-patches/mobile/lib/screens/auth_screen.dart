import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final name = TextEditingController();
  final username = TextEditingController();
  final password = TextEditingController();
  bool creating = true, busy = false, reveal = false;
  String? error, notice;
  static const internalDomain = '@login.upteachermaster.invalid';
  String get internalEmail => '${username.text.trim().toLowerCase()}$internalDomain';
  bool get validUsername => RegExp(r'^[a-z0-9][a-z0-9._]{2,19}
      .hasMatch(username.text.trim().toLowerCase());

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    final pass = password.text;
    if (!validUsername) {
      setState(() => error = 'Username 3–20 characters ka ho: a-z, 0-9, dot ya underscore.');
      return;
    }
    if (pass.length < 6) {
      setState(() => error = 'Password kam se kam 6 characters ka hona chahiye.');
      return;
    }
    if (creating) {
      if (name.text.trim().length < 2) {
        setState(() => error = 'Please enter your full name.');
        return;
      }
    }
    setState(() { busy = true; error = null; notice = null; });
    try {
      final auth = Supabase.instance.client.auth;
      if (creating) {
        final result = await auth.signUp(
          email: internalEmail,
          password: pass,
          data: {
            'full_name': name.text.trim(),
            'username': username.text.trim().toLowerCase(),
          },
        );
        if (mounted && result.session == null) {
          setState(() => notice =
            'Supabase Dashboard mein Email confirmation OFF karna zaroori hai. Abhi account bana hai, lekin confirmation ke bina login nahi hoga.');
        }
      } else {
        await auth.signInWithPassword(email: internalEmail, password: pass);
      }
    } on AuthException catch (e) {
      if (!mounted) return;
      final msg = e.message.toLowerCase();
      setState(() => error = (msg.contains('already registered') || msg.contains('already been registered'))
          ? 'Ye username pehle se registered hai. Login karein ya doosra username chunein.'
          : e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Network ya server error. Thodi der baad dobara try karein.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    name.dispose(); username.dispose(); password.dispose();
    super.dispose();
  }

  InputDecoration field(String label, IconData icon) => InputDecoration(
    labelText: label, prefixIcon: Icon(icon), border: const OutlineInputBorder());

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(22),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Icon(Icons.school_rounded, size: 68, color: Color(0xFF174A7E)),
          const SizedBox(height: 10),
          const Text('UP TEACHER MASTER', textAlign: TextAlign.center,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 1)),
          const Text('एक लक्ष्य — शिक्षक बनने का संकल्प',
            textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
          const SizedBox(height: 28),
          Text(creating ? 'Create Your Account' : 'Welcome Back',
            style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(creating
            ? 'Bas apna naam, username aur password bharein. Email ya mobile number ki zaroorat nahi.'
            : 'Apne username aur password se login karein.',
            style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 18),
          if (creating) ...[
            TextField(controller: name, textCapitalization: TextCapitalization.words,
              decoration: field('Full name', Icons.person_outline)),
            const SizedBox(height: 12),
          ],
          TextField(controller: username, autocorrect: false,
            textCapitalization: TextCapitalization.none,
            decoration: field('Username', Icons.account_circle_outlined)
              .copyWith(helperText: '3–20 characters: letters, numbers, . or _')), 
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: !reveal,
            decoration: field('Password', Icons.lock_outline).copyWith(
              suffixIcon: IconButton(onPressed: () => setState(() => reveal = !reveal),
                icon: Icon(reveal ? Icons.visibility_off : Icons.visibility)))),
          const SizedBox(height: 10),
          FilledButton(onPressed: busy ? null : submit,
            child: Text(busy ? 'Please wait…' : (creating ? 'Create Account' : 'Login'))),
          TextButton(onPressed: busy ? null : () => setState(() {
            creating = !creating; error = null; notice = null;
          }), child: Text(creating ? 'Already have an account? Login' : 'Create a new account')),
          if (notice != null) ...[
            const SizedBox(height: 8), Text(notice!, style: const TextStyle(color: Colors.orange)),
          ],
          if (error != null) ...[
            const SizedBox(height: 8), Text(error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 18),
          const Text(
            'Apna username aur password yaad rakhein. Password recovery baad mein add ki ja sakti hai.',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.black54)),
        ]))))));
}
)
      .hasMatch(username.text.trim().toLowerCase());

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    final pass = password.text;
    if (!validUsername) {
      setState(() => error = 'Username 4–20 characters ka ho: a-z, 0-9, dot ya underscore.');
      return;
    }
    if (pass.length < 8) {
      setState(() => error = 'Password kam se kam 8 characters ka hona chahiye.');
      return;
    }
    if (creating) {
      if (name.text.trim().length < 2) {
        setState(() => error = 'Please enter your full name.');
        return;
      }
      if (pass != confirm.text) {
        setState(() => error = 'Password aur Confirm Password match nahi karte.');
        return;
      }
      if (!RegExp(r'[a-z]').hasMatch(pass) || !RegExp(r'[A-Z]').hasMatch(pass) ||
          !RegExp(r'[0-9]').hasMatch(pass)) {
        setState(() => error = 'Password mein uppercase, lowercase aur number hona chahiye.');
        return;
      }
      if (!accepted) {
        setState(() => error = 'Account banane ke liye self-declaration accept karein.');
        return;
      }
    }
    setState(() { busy = true; error = null; notice = null; });
    try {
      final auth = Supabase.instance.client.auth;
      if (creating) {
        final result = await auth.signUp(
          email: internalEmail,
          password: pass,
          data: {
            'full_name': name.text.trim(),
            'username': username.text.trim().toLowerCase(),
            'self_declaration_accepted': true,
            'self_declaration_accepted_at': DateTime.now().toUtc().toIso8601String(),
          },
        );
        if (mounted && result.session == null) {
          setState(() => notice =
            'Supabase Dashboard mein Email confirmation OFF karna zaroori hai. Abhi account bana hai, lekin confirmation ke bina login nahi hoga.');
        }
      } else {
        await auth.signInWithPassword(email: internalEmail, password: pass);
      }
    } on AuthException catch (e) {
      if (!mounted) return;
      final msg = e.message.toLowerCase();
      setState(() => error = (msg.contains('already registered') || msg.contains('already been registered'))
          ? 'Ye username pehle se registered hai. Login karein ya doosra username chunein.'
          : e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Network ya server error. Thodi der baad dobara try karein.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    name.dispose(); username.dispose(); password.dispose(); confirm.dispose();
    super.dispose();
  }

  InputDecoration field(String label, IconData icon) => InputDecoration(
    labelText: label, prefixIcon: Icon(icon), border: const OutlineInputBorder());

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(22),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Icon(Icons.school_rounded, size: 68, color: Color(0xFF174A7E)),
          const SizedBox(height: 10),
          const Text('UP TEACHER MASTER', textAlign: TextAlign.center,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, letterSpacing: 1)),
          const Text('एक लक्ष्य — शिक्षक बनने का संकल्प',
            textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
          const SizedBox(height: 28),
          Text(creating ? 'Create Your Account' : 'Welcome Back',
            style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          Text(creating
            ? 'Email ya mobile number ki zaroorat nahi. Apna username aur password khud banayein.'
            : 'Apne username aur password se login karein.',
            style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 18),
          if (creating) ...[
            TextField(controller: name, textCapitalization: TextCapitalization.words,
              decoration: field('Full name', Icons.person_outline)),
            const SizedBox(height: 12),
          ],
          TextField(controller: username, autocorrect: false,
            textCapitalization: TextCapitalization.none,
            decoration: field('Username', Icons.account_circle_outlined)
              .copyWith(helperText: '4–20 characters: letters, numbers, . or _')),
          const SizedBox(height: 12),
          TextField(controller: password, obscureText: !reveal,
            decoration: field('Password', Icons.lock_outline).copyWith(
              suffixIcon: IconButton(onPressed: () => setState(() => reveal = !reveal),
                icon: Icon(reveal ? Icons.visibility_off : Icons.visibility)))),
          if (creating) ...[
            const SizedBox(height: 12),
            TextField(controller: confirm, obscureText: true,
              decoration: field('Confirm password', Icons.lock_reset)),
            const SizedBox(height: 10),
            CheckboxListTile(
              value: accepted, onChanged: (v) => setState(() => accepted = v ?? false),
              contentPadding: EdgeInsets.zero, controlAffinity: ListTileControlAffinity.leading,
              title: const Text(
                'I declare that the information provided by me is correct. I will keep my username and password safe and use this account myself.',
                style: TextStyle(fontSize: 13))),
          ],
          const SizedBox(height: 10),
          FilledButton(onPressed: busy ? null : submit,
            child: Text(busy ? 'Please wait…' : (creating ? 'Create Account' : 'Login'))),
          TextButton(onPressed: busy ? null : () => setState(() {
            creating = !creating; error = null; notice = null;
          }), child: Text(creating ? 'Already have an account? Login' : 'New student? Create account')),
          if (notice != null) ...[
            const SizedBox(height: 8), Text(notice!, style: const TextStyle(color: Colors.orange)),
          ],
          if (error != null) ...[
            const SizedBox(height: 8), Text(error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 18),
          const Text(
            'Important: Abhi password recovery available nahi hai. Apna username aur password yaad rakhein. Email/mobile baad mein add kiye ja sakte hain.',
            textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: Colors.black54)),
        ]))))));
}
