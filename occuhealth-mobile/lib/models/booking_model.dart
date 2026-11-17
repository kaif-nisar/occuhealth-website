import 'dart:convert';

class BookingSampleVial {
  final String typeOfSample;
  final String barcodeId;
  final String confirmBarcodeId;
  final String testName;
  final List<dynamic> ids;

  BookingSampleVial({
    required this.typeOfSample,
    required this.barcodeId,
    required this.confirmBarcodeId,
    required this.testName,
    required this.ids,
  });

  factory BookingSampleVial.fromJson(Map<String, dynamic> json) {
    return BookingSampleVial(
      typeOfSample: json['typeOfSample']?.toString() ?? 'Serum',
      barcodeId: json['barcodeId']?.toString() ?? json['confirmBarcodeId']?.toString() ?? '',
      confirmBarcodeId: json['confirmBarcodeId']?.toString() ?? json['barcodeId']?.toString() ?? '',
      testName: json['testName']?.toString() ?? '',
      ids: json['ids'] is List ? json['ids'] : [],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'typeOfSample': typeOfSample,
      'barcodeId': barcodeId,
      'confirmBarcodeId': confirmBarcodeId,
      'testName': testName,
      'ids': ids,
    };
  }
}

class BookingModel {
  final String id;
  final String bookingId;
  final String patientName;
  final String year;
  final String gender;
  final String? patientPhone;
  final String? doctorName;
  final String? labName;
  final String status;
  final double total;
  final String? date;
  final String? time;
  final DateTime? createdAt;
  final List<BookingSampleVial> tableData;
  final List<String> barcodeList;
  final String? createdByUser;
  final String? createdByRole;
  final bool isSignedOff;
  final String? fileUrl;
  final String? clinicalHistory;
  final double discountAmount;
  final Map<String, dynamic>? rawJson;

  BookingModel({
    required this.id,
    required this.bookingId,
    required this.patientName,
    required this.year,
    required this.gender,
    this.patientPhone,
    this.doctorName,
    this.labName,
    required this.status,
    required this.total,
    this.date,
    this.time,
    this.createdAt,
    required this.tableData,
    required this.barcodeList,
    this.createdByUser,
    this.createdByRole,
    this.isSignedOff = false,
    this.fileUrl,
    this.clinicalHistory,
    this.discountAmount = 0.0,
    this.rawJson,
  });

  String get formattedAge {
    if (year.isEmpty) return '—';
    final str = year.trim();
    if (RegExp(r'^\d+$').hasMatch(str)) {
      return '$str Yrs';
    }
    return str;
  }

  String get formattedGender {
    final g = gender.trim().toLowerCase();
    if (g == 'male' || g == 'm') return 'Male';
    if (g == 'female' || g == 'f') return 'Female';
    if (g == 'other' || g == 'o') return 'Other';
    return gender.isNotEmpty ? gender : 'N/A';
  }

  String get statusDisplay {
    final s = status.trim().toLowerCase();
    if (s == 'booked') return 'Booked';
    if (s == 'pending') return 'Pending';
    if (s == 'completed') return 'Completed';
    if (s.contains('partial')) return 'Partially Completed';
    if (s.contains('hold')) return 'On Hold';
    if (s.contains('clinical')) return 'Clinical';
    if (s.contains('cancel')) return 'Cancelled';
    return status.isNotEmpty ? status : 'Pending';
  }

  factory BookingModel.fromJson(Map<String, dynamic> json) {
    // Parse tableData
    List<BookingSampleVial> vials = [];
    if (json['tableData'] is List) {
      vials = (json['tableData'] as List)
          .map((v) => BookingSampleVial.fromJson(v is Map<String, dynamic> ? v : {}))
          .toList();
    } else if (json['tableData'] is String) {
      try {
        final decoded = jsonDecode(json['tableData']);
        if (decoded is List) {
          vials = decoded
              .map((v) => BookingSampleVial.fromJson(v is Map<String, dynamic> ? v : {}))
              .toList();
        }
      } catch (_) {}
    }

    // Parse barcodes
    List<String> barcodes = [];
    if (json['barcodeList'] is List) {
      barcodes = (json['barcodeList'] as List).map((e) => e.toString()).toList();
    } else if (json['barcodeId'] != null) {
      barcodes = [json['barcodeId'].toString()];
    }

    // Parse createdBy user
    String? createdUser;
    String? createdRole;
    if (json['createdBy'] is Map) {
      createdUser = json['createdBy']['fullName']?.toString() ?? json['createdBy']['username']?.toString();
      createdRole = json['createdBy']['role']?.toString();
    } else if (json['createdbyuser'] != null) {
      createdUser = json['createdbyuser'].toString();
    }

    DateTime? createdDt;
    if (json['createdAt'] != null) {
      createdDt = DateTime.tryParse(json['createdAt'].toString());
    }

    final totalVal = json['total'] ?? json['finalPrice'] ?? 0;
    final discountVal = json['discountamount'] ?? json['discountAmount'] ?? 0;

    return BookingModel(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      bookingId: json['bookingId']?.toString() ?? json['barcodeId']?.toString() ?? '',
      patientName: json['patientName']?.toString() ?? 'Unknown Patient',
      year: json['year']?.toString() ?? json['age']?.toString() ?? '',
      gender: json['gender']?.toString() ?? 'Male',
      patientPhone: json['patientPhone']?.toString() ?? json['mobileNumber']?.toString(),
      doctorName: json['doctorName']?.toString() ?? json['savedDoctor']?.toString() ?? 'Self',
      labName: json['labName']?.toString() ?? json['savedLab']?.toString(),
      status: json['status']?.toString() ?? 'booked',
      total: double.tryParse(totalVal.toString()) ?? 0.0,
      date: json['date']?.toString(),
      time: json['time']?.toString(),
      createdAt: createdDt,
      tableData: vials,
      barcodeList: barcodes,
      createdByUser: createdUser,
      createdByRole: createdRole,
      isSignedOff: json['signOffAudit']?['isSignedOff'] == true || json['isSignedOff'] == true,
      fileUrl: json['file']?.toString() ?? json['fileUrl']?.toString(),
      clinicalHistory: json['clinicalHistory']?.toString(),
      discountAmount: double.tryParse(discountVal.toString()) ?? 0.0,
      rawJson: json,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'bookingId': bookingId,
      'patientName': patientName,
      'year': year,
      'gender': gender,
      'patientPhone': patientPhone,
      'doctorName': doctorName,
      'labName': labName,
      'status': status,
      'total': total,
      'date': date,
      'time': time,
      'createdAt': createdAt?.toIso8601String(),
      'tableData': tableData.map((e) => e.toJson()).toList(),
      'barcodeList': barcodeList,
      'createdByUser': createdByUser,
      'createdByRole': createdByRole,
      'isSignedOff': isSignedOff,
      'fileUrl': fileUrl,
      'clinicalHistory': clinicalHistory,
      'discountAmount': discountAmount,
    };
  }
}

