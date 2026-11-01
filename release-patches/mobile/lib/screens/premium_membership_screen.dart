import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

/// Google Play builds must not route digital subscriptions to an external
/// payment provider. Direct APK builds retain the existing Razorpay option.
const bool _playStoreBuild = bool.fromEnvironment(
  'PLAY_STORE_BUILD',
  defaultValue: false,
);

class PremiumMembershipScreen extends StatefulWidget {
  final String language;
  const PremiumMembershipScreen({super.key, this.language = 'en'});

  @override
  State<PremiumMembershipScreen> createState() => _PremiumMembershipScreenState();
}

class _PremiumMembershipScreenState extends State<PremiumMembershipScreen> {
  final db = Supabase.instance.client;
  Razorpay? razorpay;
  List<Map<String, dynamic>> plans = [];
  Map<String, dynamic> membership = {};
  bool loading = true;
  bool paying = false;

  bool get hi => widget.language == 'hi';
  String t(String en, String hindi) => hi ? hindi : en;

  @override
  void initState() {
    super.initState();
    if (!_playStoreBuild) {
      razorpay = Razorpay()
        ..on(Razorpay.EVENT_PAYMENT_SUCCESS, _success)
        ..on(Razorpay.EVENT_PAYMENT_ERROR, _failure)
        ..on(Razorpay.EVENT_EXTERNAL_WALLET, _wallet);
    }
    _load();
  }

  @override
  void dispose() {
    razorpay?.clear();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final p = await db
          .from('membership_plans')
          .select()
          .eq('is_active', true)
          .order('display_order');
      final m = await db.rpc('get_my_membership');
      if (!mounted) return;
      setState(() {
        plans = List<Map<String, dynamic>>.from(p);
        membership = Map<String, dynamic>.from(m as Map);
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _buy(Map<String, dynamic> plan) async {
    if (_playStoreBuild || paying) return;
    setState(() => paying = true);
    try {
      final result = await db.functions.invoke(
        'create-payment-order',
        body: {'plan_id': plan['id']},
      );
      if (result.status != 200) {
        throw Exception(
          result.data is Map ? result.data['error'] : 'Payment setup error',
        );
      }
      final data = Map<String, dynamic>.from(result.data as Map);
      final order = Map<String, dynamic>.from(data['order'] as Map);
      razorpay!.open({
        'key': data['key_id'],
        'amount': order['amount_paise'],
        'currency': order['currency'],
        'name': 'UP Teacher Master',
        'description': plan['name_en'],
        'order_id': order['provider_order_id'],
        'prefill': {'email': db.auth.currentUser?.email ?? ''},
        'theme': {'color': '#174A7E'},
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
      setState(() => paying = false);
    }
  }

  void _success(PaymentSuccessResponse response) {
    if (!mounted) return;
    setState(() => paying = false);
    _load();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(t(
          'Payment received. Premium will activate after secure server verification.',
          'भुगतान प्राप्त हुआ। सुरक्षित सर्वर सत्यापन के बाद प्रीमियम सक्रिय होगा।',
        )),
      ),
    );
  }

  void _failure(PaymentFailureResponse response) {
    if (!mounted) return;
    setState(() => paying = false);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(t(
          'Payment was not completed.',
          'भुगतान पूरा नहीं हुआ।',
        )),
      ),
    );
  }

  void _wallet(ExternalWalletResponse response) {
    if (mounted) setState(() => paying = false);
  }

  @override
  Widget build(BuildContext context) {
    final active = membership['is_premium'] == true;
    final sub = membership['subscription'];
    final rawOrders = membership['recent_orders'];
    final orders = rawOrders is List ? rawOrders : const [];

    return Scaffold(
      appBar: AppBar(
        title: Text(t('Premium Membership', 'प्रीमियम सदस्यता')),
      ),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(18),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.workspace_premium,
                              color: Color(0xFFB8860B),
                              size: 30,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                active
                                    ? t('Premium Active', 'प्रीमियम सक्रिय')
                                    : t('Free Membership', 'फ्री सदस्यता'),
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          active && sub is Map
                              ? '${sub['plan_name_en'] ?? 'Premium'} · ${t('Expires', 'समाप्ति')} ${DateTime.tryParse('${sub['expires_at']}')?.toLocal().toString().split('.').first ?? ''}'
                              : t(
                                  'Unlock premium mock tests and study resources.',
                                  'प्रीमियम मॉक टेस्ट और स्टडी सामग्री अनलॉक करें।',
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  t('Choose a plan', 'प्लान चुनें'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                ...plans.map((plan) {
                  final amount =
                      ((plan['price_paise'] as num?) ?? 0) / 100;
                  return Card(
                    child: ListTile(
                      leading: const Icon(Icons.stars),
                      title: Text(
                        hi
                            ? '${plan['name_hi'] ?? plan['name_en']}'
                            : '${plan['name_en']}',
                      ),
                      subtitle: Text(
                        '${plan['duration_days']} ${t('days', 'दिन')}',
                      ),
                      trailing: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            '₹${amount.toStringAsFixed(0)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          if (_playStoreBuild)
                            Text(
                              t('Coming soon', 'जल्द उपलब्ध होगा'),
                              style: const TextStyle(fontSize: 11),
                            )
                          else
                            TextButton(
                              onPressed: paying ? null : () => _buy(plan),
                              child: Text(t('Buy', 'खरीदें')),
                            ),
                        ],
                      ),
                    ),
                  );
                }),
                if (paying) const LinearProgressIndicator(),
                const SizedBox(height: 16),
                Text(
                  t(
                    'Secure payment verification',
                    'सुरक्षित भुगतान सत्यापन',
                  ),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(t(
                  'Premium access is activated only after the payment provider sends a verified server webhook. A payment success screen alone does not grant access.',
                  'प्रीमियम एक्सेस तभी मिलेगा जब पेमेंट प्रोवाइडर का सत्यापित सर्वर वेबहुक प्राप्त होगा। केवल पेमेंट सक्सेस स्क्रीन से एक्सेस नहीं मिलेगा।',
                )),
                const SizedBox(height: 22),
                Text(
                  t('Purchase History', 'खरीदारी का इतिहास'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 8),
                ...orders.map((raw) {
                  final order = Map<String, dynamic>.from(raw as Map);
                  final amount =
                      (((order['amount_paise'] as num?) ?? 0) / 100)
                          .toStringAsFixed(2);
                  final date = DateTime.tryParse(
                        '${order['created_at']}',
                      )
                          ?.toLocal()
                          .toString()
                          .split('.')
                          .first ??
                      '';
                  final status = '${order['status'] ?? ''}'.toUpperCase();
                  return Card(
                    child: ListTile(
                      leading: const Icon(Icons.receipt_long),
                      title: Text('₹$amount · $status'),
                      subtitle: Text(date),
                    ),
                  );
                }),
                if (orders.isEmpty)
                  Text(t('No purchases yet.', 'अभी तक कोई खरीदारी नहीं हुई।')),
              ],
            ),
    );
  }
}
