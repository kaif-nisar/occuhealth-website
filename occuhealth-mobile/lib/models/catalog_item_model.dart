class CatalogItemModel {
  final String id;
  final String name;
  final double price;
  final String sampleType;
  final String shortName;
  final String collection; // testSchema, addPannel, Package
  final String typeLabel;  // Test, Panel, Package

  CatalogItemModel({
    required this.id,
    required this.name,
    required this.price,
    required this.sampleType,
    required this.shortName,
    required this.collection,
    required this.typeLabel,
  });

  bool get isTest => collection == 'testSchema';
  bool get isPanel => collection == 'addPannel';
  bool get isPackage => collection == 'Package';

  List<String> get sampleTypesList {
    if (sampleType.isEmpty) return ['Serum'];
    final list = sampleType
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty && s.toLowerCase() != 'null')
        .toList();
    return list.isNotEmpty ? list : ['Serum'];
  }

  factory CatalogItemModel.fromTestJson(Map<String, dynamic> json) {
    final priceVal = json['myPrice'] ?? json['finalPrice'] ?? json['mrpPrice'] ?? json['basePrice'] ?? 0;
    return CatalogItemModel(
      id: json['testId']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['testName']?.toString() ?? json['Name']?.toString() ?? 'Unnamed Test',
      price: double.tryParse(priceVal.toString()) ?? 0.0,
      sampleType: json['sampleType']?.toString() ?? 'Blood',
      shortName: json['Short_name']?.toString() ?? json['shortName']?.toString() ?? '',
      collection: 'testSchema',
      typeLabel: 'Test',
    );
  }

  factory CatalogItemModel.fromPanelJson(Map<String, dynamic> json) {
    final priceVal = json['myPrice'] ?? json['finalPrice'] ?? json['mrpPrice'] ?? json['basePrice'] ?? 0;
    return CatalogItemModel(
      id: json['panelId']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['panelName']?.toString() ?? json['name']?.toString() ?? 'Unnamed Panel',
      price: double.tryParse(priceVal.toString()) ?? 0.0,
      sampleType: json['sampleType']?.toString() ?? 'Blood,Serum',
      shortName: json['Short_name']?.toString() ?? json['short_name']?.toString() ?? '',
      collection: 'addPannel',
      typeLabel: 'Panel',
    );
  }

  factory CatalogItemModel.fromPackageJson(Map<String, dynamic> json) {
    final priceVal = json['myPrice'] ?? json['finalPrice'] ?? json['packageFee'] ?? json['basePrice'] ?? 0;
    String resolvedSamples = 'Blood,Serum';
    if (json['sampleType'] is List) {
      final list = (json['sampleType'] as List).map((e) => e.toString()).toList();
      if (list.isNotEmpty) resolvedSamples = list.join(',');
    } else if (json['sampleType'] != null) {
      resolvedSamples = json['sampleType'].toString();
    }

    return CatalogItemModel(
      id: json['packageId']?.toString() ?? json['_id']?.toString() ?? '',
      name: json['packageName']?.toString() ?? json['name']?.toString() ?? 'Unnamed Package',
      price: double.tryParse(priceVal.toString()) ?? 0.0,
      sampleType: resolvedSamples,
      shortName: json['shortName']?.toString() ?? '',
      collection: 'Package',
      typeLabel: 'Package',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'price': price,
      'sampleType': sampleType,
      'shortName': shortName,
      'collection': collection,
      'typeLabel': typeLabel,
    };
  }
}

