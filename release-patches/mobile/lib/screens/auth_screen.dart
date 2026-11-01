import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../app_config.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController();
  final otp = TextEditingController();
  bool otpSent = false;
  bool busy = false;
  String? error;
  String? notice;

  Future<void> sendOtp() async {
    final address = email.text.trim();
    if (address.isEmpty || !address.contains('@')) {
      setState(() => error = 'Please enter a valid email address.');
      return;
    }
    setState(() { busy = true; error = null; notice = null; });
    try {
      await Supabase.instance.client.auth.signInWithOtp(email: address);
      if (!mounted) return;
      setState(() {
        otpSent = true;
        notice = 'A verification code has been sent to $address';
      });
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Unable to send the code. Please try again.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> verifyOtp() async {
    final code = otp.text.trim();
    if (code.length != 6) {
      setState(() => error = 'Please enter the 6-digit verification code.');
      return;
    }
    setState(() { busy = true; error = null; notice = null; });
    try {
      await Supabase.instance.client.auth.verifyOTP(
        email: email.text.trim(),
        token: code,
        type: OtpType.email,
      );
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Code verification failed. Please try again.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> googleLogin() async {
    setState(() { busy = true; error = null; notice = null; });
    try {
      await Supabase.instance.client.auth.signInWithOAuth(
        OAuthProvider.google,
        redirectTo: AppConfig.authRedirectUrl,
      );
    } on AuthException catch (e) {
      if (mounted) setState(() => error = e.message);
    } catch (_) {
      if (mounted) setState(() => error = 'Google sign-in could not be started.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    email.dispose();
    otp.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.school_rounded, size: 72, color: Color(0xFF174A7E)),
                const SizedBox(height: 12),
                const Text('UP TEACHER MASTER',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 25, fontWeight: FontWeight.bold, letterSpacing: 1)),
                const Text('एक लक्ष्य — शिक्षक बनने का संकल्प',
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
                const SizedBox(height: 36),
                Text(otpSent ? 'Verify your email' : 'Welcome, Aspirant!',
                  style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text(otpSent
                    ? 'Enter the 6-digit code sent to your email.'
                    : 'Sign in securely using a one-time email code.',
                  style: const TextStyle(color: Colors.black54)),
                const SizedBox(height: 18),
                if (!otpSent) ...[
                  TextField(
                    controller: email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: const InputDecoration(
                      labelText: 'Email address',
                      hintText: 'name@example.com',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.email_outlined),
                    ),
                  ),
                  const SizedBox(height: 14),
                  FilledButton(
                    onPressed: busy ? null : sendOtp,
                    child: Text(busy ? 'Please wait…' : 'Send Email OTP'),
                  ),
                ] else ...[
                  Text('Code sent to ${email.text.trim()}',
                    style: const TextStyle(color: Colors.black54)),
                  const SizedBox(height: 12),
                  TextField(
                    controller: otp,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                      labelText: '6-digit verification code',
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.lock_outline),
                    ),
                  ),
                  const SizedBox(height: 8),
                  FilledButton(
                    onPressed: busy ? null : verifyOtp,
                    child: Text(busy ? 'Verifying…' : 'Verify and Continue'),
                  ),
                  TextButton(
                    onPressed: busy ? null : sendOtp,
                    child: const Text('Resend code'),
                  ),
                  TextButton(
                    onPressed: busy ? null : () => setState(() {
                      otpSent = false;
                      otp.clear();
                      error = null;
                      notice = null;
                    }),
                    child: const Text('Change email address'),
                  ),
                ],
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: busy ? null : googleLogin,
                  icon: const Icon(Icons.g_mobiledata, size: 30),
                  label: const Text('Continue with Google'),
                ),
                if (notice != null) ...[
                  const SizedBox(height: 12),
                  Text(notice!, style: const TextStyle(color: Colors.green)),
                ],
                if (error != null) ...[
                  const SizedBox(height: 12),
                  Text(error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 24),
                const Text('By continuing, you agree to our Terms and Privacy Policy.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 12, color: Colors.black54)),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
