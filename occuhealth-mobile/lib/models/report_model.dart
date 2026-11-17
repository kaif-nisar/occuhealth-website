class ReportParameterModel {
  final String testId;
  final String testName;
  String result;
  final String unit;
  final String normalRange;
  String status;

  ReportParameterModel({
    required this.testId,
    required this.testName,
    required this.result,
    required this.unit,
    required this.normalRange,
    this.status = 'Normal',
  });

  factory ReportParameterModel.fromJson(Map<String, dynamic> json) {
    return ReportParameterModel(
      testId: json['testId']?.toString() ?? json['_id']?.toString() ?? '',
      testName: json['testName']?.toString() ?? json['Name']?.toString() ?? '',
      result: json['result']?.toString() ?? json['default_result']?.toString() ?? '',
      unit: json['unit']?.toString() ?? json['Unit']?.toString() ?? '',
      normalRange: json['normalRange']?.toString() ?? json['General_Normal_Range']?.toString() ?? '',
      status: json['status']?.toString() ?? 'Normal',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'testId': testId,
      'testName': testName,
      'result': result,
      'unit': unit,
      'normalRange': normalRange,
      'status': status,
    };
  }
}

class ReportCategoryModel {
  final String category;
  final String title;
  final String type; // test or panel
  final List<ReportParameterModel> tests;

  ReportCategoryModel({
    required this.category,
    required this.title,
    required this.type,
    required this.tests,
  });

  factory ReportCategoryModel.fromJson(Map<String, dynamic> json) {
    List<ReportParameterModel> parsedTests = [];
    if (json['tests'] is List) {
      parsedTests = (json['tests'] as List)
          .map((t) => ReportParameterModel.fromJson(t is Map<String, dynamic> ? t : {}))
          .toList();
    }

    return ReportCategoryModel(
      category: json['category']?.toString() ?? 'General',
      title: json['title']?.toString() ?? json['category']?.toString() ?? 'General',
      type: json['type']?.toString() ?? 'test',
      tests: parsedTests,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'category': category,
      'title': title,
      'type': type,
      'tests': tests.map((t) => t.toJson()).toList(),
    };
  }
}

class ReportDataModel {
  final String bookingId;
  final String? patientName;
  final List<ReportCategoryModel> categories;
  String moreDetails;
  bool isSignedOff;
  final String? signedOffBy;
  final String? reportedOn;

  ReportDataModel({
    required this.bookingId,
    this.patientName,
    required this.categories,
    this.moreDetails = '',
    this.isSignedOff = false,
    this.signedOffBy,
    this.reportedOn,
  });

  factory ReportDataModel.fromJson(Map<String, dynamic> json, String bookingId) {
    List<ReportCategoryModel> cats = [];
    final rawCats = json['CategoryAndTest'] ?? json['categories'] ?? json['reportData'];
    if (rawCats is List) {
      cats = rawCats
          .map((c) => ReportCategoryModel.fromJson(c is Map<String, dynamic> ? c : {}))
          .toList();
    }

    final signOffObj = json['signOffAudit'] is Map ? json['signOffAudit'] : null;
    final isSigned = signOffObj?['isSignedOff'] == true || json['isSignedOff'] == true;

    return ReportDataModel(
      bookingId: bookingId,
      patientName: json['patientName']?.toString(),
      categories: cats,
      moreDetails: json['moredetails']?.toString() ?? json['MoreDetails']?.toString() ?? '',
      isSignedOff: isSigned,
      signedOffBy: signOffObj?['signedOffBy']?['fullName']?.toString() ?? signOffObj?['signedOffBy']?['username']?.toString(),
      reportedOn: json['reportedOn']?.toString() ?? json['updatedAt']?.toString(),
    );
  }
}

