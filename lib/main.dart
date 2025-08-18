import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;

void main() {
  runApp(MaterialApp(
    home: CodeSearchPage(),
    debugShowCheckedModeBanner: false,
  ));
}

class CodeSearchPage extends StatefulWidget {
  @override
  State<CodeSearchPage> createState() => _CodeSearchPageState();
}

class _CodeSearchPageState extends State<CodeSearchPage> {
  Map<String, dynamic> codes = {};
  String result = "";

  @override
  void initState() {
    super.initState();
    loadCodes();
  }

  Future<void> loadCodes() async {
    final data = await rootBundle.loadString("codes.json");
    setState(() {
      codes = json.decode(data);
    });
  }

  void search(String code) {
    setState(() {
      result = codes[code] ?? "Code inconnu";
    });
  }

  @override
  Widget build(BuildContext context) {
    final controller = TextEditingController();
    return Scaffold(
      appBar: AppBar(title: Text("DiagClimo")),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            TextField(
              controller: controller,
              decoration: InputDecoration(
                labelText: "Entrer un code",
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 10),
            ElevatedButton(
              onPressed: () => search(controller.text.trim()),
              child: Text("Rechercher"),
            ),
            SizedBox(height: 20),
            Text(result, style: TextStyle(fontSize: 18)),
          ],
        ),
      ),
    );
  }
}
