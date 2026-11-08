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
  bool get validUsername => RegExp(r'^[a-z0-9][a-z0-9._]{2,19}$')
      .hasMatch(username.text.trim().toLowerCase());

  Future<void> submit() async {
    FocusScope.of(context).unfocus();
    final pass = password.text;
    if (!validUsername) {
      setState(() => error = 'Username 3–20 characters ka rakhein (letters, numbers, dot ya underscore).');
      return;
    }
    if (pass.length < 6) {
      setState(() => error = 'Password kam se kam 6 characters ka hona chahiye.');
      return;
    }
    if (creating && name.text.trim().length < 2) {
      setState(() => error = 'Please enter your name.');
      return;
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
            'Account bana hai, lekin login ke liye admin ko Supabase mein email confirmation OFF karna hoga.');
        }
      } else {
        await auth.signInWithPassword(email: internalEmail, password: pass);
      }
    } on AuthException catch (e) {
      if (!mounted) return;
      final msg = e.message.toLowerCase();
      setState(() => error =
        (msg.contains('already registered') || msg.contains('already been registered'))
          ? 'Ye username pehle se registered hai. Login karein.'
          : e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Internet/server problem. Please try again.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    name.dispose();
    username.dispose();
    password.dispose();
    super.dispose();
  }

  InputDecoration field(String label, IconData icon) => InputDecoration(
    labelText: label,
    prefixIcon: Icon(icon),
    border: const OutlineInputBorder(),
  );

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
            ? 'Bas apna naam, username aur password bharein. Email ya mobile ki zaroorat nahi.'
            : 'Username aur password se login karein.',
            style: const TextStyle(color: Colors.black54)),
          const SizedBox(height: 18),
          if (creating) ...[
            TextField(controller: name,
              textCapitalization: TextCapitalization.words,
              textInputAction: TextInputAction.next,
              decoration: field('Your Name', Icons.person_outline)),
            const SizedBox(height: 12),
          ],
          TextField(controller: username,
            autocorrect: false,
            textCapitalization: TextCapitalization.none,
            textInputAction: TextInputAction.next,
            decoration: field('Choose Username', Icons.account_circle_outlined)
              .copyWith(helperText: 'At least 3 characters')),
          const SizedBox(height: 12),
          TextField(controller: password,
            obscureText: !reveal,
            textInputAction: TextInputAction.done,
            onSubmitted: (_) => busy ? null : submit(),
            decoration: field('Choose Password', Icons.lock_outline).copyWith(
              helperText: creating ? 'At least 6 characters' : null,
              suffixIcon: IconButton(
                onPressed: () => setState(() => reveal = !reveal),
                icon: Icon(reveal ? Icons.visibility_off : Icons.visibility),
              ),
            )),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : submit,
            child: Text(busy ? 'Please wait…' : (creating ? 'Create Account' : 'Login')),
          ),
          TextButton(onPressed: busy ? null : () => setState(() {
            creating = !creating;
            error = null;
            notice = null;
          }), child: Text(creating ? 'Already registered? Login' : 'New here? Create Account')),
          if (notice != null) ...[
            const SizedBox(height: 8),
            Text(notice!, style: const TextStyle(color: Colors.orange)),
          ],
          if (error != null) ...[
            const SizedBox(height: 8),
            Text(error!, style: const TextStyle(color: Colors.red)),
          ],
          const SizedBox(height: 18),
          const Text(
            'Apna username aur password yaad rakhein. Password recovery abhi available nahi hai.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12, color: Colors.black54),
          ),
        ]))))));
}
