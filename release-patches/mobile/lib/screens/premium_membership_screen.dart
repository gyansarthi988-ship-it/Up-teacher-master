import 'package:flutter/material.dart';

class PremiumMembershipScreen extends StatelessWidget {
  final String language;
  const PremiumMembershipScreen({super.key, this.language = 'en'});

  @override
  Widget build(BuildContext context) {
    final hi = language == 'hi';
    return Scaffold(
      appBar: AppBar(title: Text(hi ? 'सभी सुविधाएँ मुफ्त' : 'All Features Free')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.verified, size: 56, color: Colors.green),
                  const SizedBox(height: 16),
                  Text(
                    hi ? 'UP Teacher Master सभी विद्यार्थियों के लिए मुफ्त है।' : 'UP Teacher Master is free for every student.',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    hi ? 'आप अपने कोर्स चुनकर उपलब्ध प्रैक्टिस टेस्ट और मॉक टेस्ट बिना किसी भुगतान के हल कर सकते हैं।' : 'Choose your course and solve available practice tests and mock tests without any payment.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
