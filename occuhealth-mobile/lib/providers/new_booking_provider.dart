import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/catalog_item_model.dart';
import '../models/doctor_model.dart';
import '../models/lab_model.dart';
import '../models/wallet_model.dart';
import '../services/booking_service.dart';
import '../services/catalog_service.dart';

class SampleVialGroup {
  final String sampleType;
  final String barcodeId;
  final List<String> testNames;
  final List<Map<String, String>> ids;

  SampleVialGroup({
    required this.sampleType,
    required this.barcodeId,
    required this.testNames,
    required this.ids,
  });
}

class NewBookingProvider extends ChangeNotifier {
  // Patient Details
  String _patientName = '';
  String _ageValue = '';
  String _ageUnit = 'Yrs';
  String _gender = 'Male';
  String _patientPhone = '';

  // Doctor & Lab
  List<DoctorModel> _doctorList = [];
  DoctorModel? _selectedDoctor;
  String _customDoctorName = '';

  List<LabModel> _labList = [];
  LabModel? _selectedLab;
  String _customLabName = '';

  // File Attachment
  File? _attachedFile;

  // Discount
  double _discountAmount = 0.0;

  // Booking Meta
  String _barcodeId = '';
  String _clinicalHistory = '';
  WalletModel _wallet = WalletModel(balance: 0);

  // Catalog & Selection
  List<CatalogItemModel> _allCatalog = [];
  String _catalogFilter = 'All'; // All, Tests, Panels, Packages
  String _searchQuery = '';
  final List<CatalogItemModel> _selectedItems = [];

  // Loading States
  bool _isLoadingInitial = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  // Getters
  String get patientName => _patientName;
  String get ageValue => _ageValue;
  String get ageUnit => _ageUnit;
  String get gender => _gender;
  String get patientPhone => _patientPhone;

  List<DoctorModel> get doctorList => _doctorList;
  DoctorModel? get selectedDoctor => _selectedDoctor;
  String get doctorDisplayName =>
      _selectedDoctor != null ? _selectedDoctor!.displayName : _customDoctorName;

  List<LabModel> get labList => _labList;
  LabModel? get selectedLab => _selectedLab;
  String get labDisplayName =>
      _selectedLab != null ? _selectedLab!.labName : _customLabName;

  File? get attachedFile => _attachedFile;
  double get discountAmount => _discountAmount;
  String get barcodeId => _barcodeId;
  String get clinicalHistory => _clinicalHistory;
  WalletModel get wallet => _wallet;

  List<CatalogItemModel> get selectedItems => _selectedItems;
  String get catalogFilter => _catalogFilter;
  String get searchQuery => _searchQuery;
  bool get isLoadingInitial => _isLoadingInitial;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;

  static String generateBarcode() {
    final randomNum = 10000000 + Random().nextInt(90000000);
    return 'OH$randomNum';
  }

  // Filtered Catalog
  List<CatalogItemModel> get filteredCatalog {
    List<CatalogItemModel> list = _allCatalog;

    if (_catalogFilter == 'Tests') {
      list = list.where((i) => i.isTest).toList();
    } else if (_catalogFilter == 'Panels') {
      list = list.where((i) => i.isPanel).toList();
    } else if (_catalogFilter == 'Packages') {
      list = list.where((i) => i.isPackage).toList();
    }

    final q = _searchQuery.trim().toLowerCase();
    if (q.isEmpty) {
      return list.take(15).toList();
    }

    return list.where((i) {
      final nameMatch = i.name.toLowerCase().contains(q);
      final shortMatch = i.shortName.toLowerCase().contains(q);
      return nameMatch || shortMatch;
    }).take(25).toList();
  }

  // Computed Sample Vials (Grouping by sample type)
  List<SampleVialGroup> get sampleVials {
    final Map<String, List<CatalogItemModel>> map = {};

    for (final item in _selectedItems) {
      for (final sType in item.sampleTypesList) {
        map.putIfAbsent(sType, () => []).add(item);
      }
    }

    return map.entries.map((entry) {
      final sampleType = entry.key;
      final items = entry.value;

      return SampleVialGroup(
        sampleType: sampleType,
        barcodeId: generateBarcode(),
        testNames: items.map((i) => i.name).toSet().toList(),
        ids: items.map((i) => {'id': i.id, 'collectionName': i.collection}).toList(),
      );
    }).toList();
  }

  // Price Calculation
  double get subTotal {
    return _selectedItems.fold(0.0, (acc, curr) => acc + curr.price);
  }

  double get grandTotal {
    final total = subTotal - _discountAmount;
    return total > 0 ? total : 0.0;
  }

  // Initialize
  Future<void> initForm(String? userId) async {
    _isLoadingInitial = true;
    _errorMessage = null;
    _barcodeId = generateBarcode();
    notifyListeners();

    try {
      final results = await Future.wait([
        CatalogService.getAssignedTests(userId),
        CatalogService.getAllPanels(userId),
        CatalogService.getAllPackages(userId),
        CatalogService.getAllDoctors(userId),
        CatalogService.getAllLabs(userId),
        CatalogService.getWalletBalance(userId),
      ]);

      final tests = results[0] as List<CatalogItemModel>;
      final panels = results[1] as List<CatalogItemModel>;
      final packages = results[2] as List<CatalogItemModel>;
      _doctorList = results[3] as List<DoctorModel>;
      _labList = results[4] as List<LabModel>;
      _wallet = results[5] as WalletModel;

      _allCatalog = [...tests, ...panels, ...packages];
    } catch (e) {
      _errorMessage = 'Could not load test catalog: ${e.toString()}';
    } finally {
      _isLoadingInitial = false;
      notifyListeners();
    }
  }

  // Form Field Setters
  void setPatientName(String val) {
    _patientName = val;
    notifyListeners();
  }

  void setAge(String val) {
    _ageValue = val;
    notifyListeners();
  }

  void setAgeUnit(String val) {
    _ageUnit = val;
    notifyListeners();
  }

  void setGender(String val) {
    _gender = val;
    notifyListeners();
  }

  void setPatientPhone(String val) {
    _patientPhone = val;
    notifyListeners();
  }

  void selectDoctor(DoctorModel? doc) {
    _selectedDoctor = doc;
    _customDoctorName = doc?.displayName ?? '';
    notifyListeners();
  }

  void setCustomDoctorName(String name) {
    _customDoctorName = name;
    _selectedDoctor = null;
    notifyListeners();
  }

  void selectLab(LabModel? lab) {
    _selectedLab = lab;
    _customLabName = lab?.labName ?? '';
    notifyListeners();
  }

  void setCustomLabName(String name) {
    _customLabName = name;
    _selectedLab = null;
    notifyListeners();
  }

  void setAttachedFile(File? file) {
    _attachedFile = file;
    notifyListeners();
  }

  void removeAttachedFile() {
    _attachedFile = null;
    notifyListeners();
  }

  void setDiscount(double amount) {
    _discountAmount = amount;
    notifyListeners();
  }

  void setClinicalHistory(String val) {
    _clinicalHistory = val;
    notifyListeners();
  }

  void setCatalogFilter(String filter) {
    _catalogFilter = filter;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  // Test Selection Actions
  bool isItemSelected(CatalogItemModel item) {
    return _selectedItems.any((i) => i.id == item.id && i.collection == item.collection);
  }

  void toggleSelectItem(CatalogItemModel item) {
    final index = _selectedItems.indexWhere((i) => i.id == item.id && i.collection == item.collection);
    if (index >= 0) {
      _selectedItems.removeAt(index);
    } else {
      _selectedItems.add(item);
    }
    notifyListeners();
  }

  void removeItem(CatalogItemModel item) {
    _selectedItems.removeWhere((i) => i.id == item.id && i.collection == item.collection);
    notifyListeners();
  }

  // Add New Doctor
  Future<DoctorModel> createDoctor({
    required String firstName,
    required String lastName,
    required String specialization,
    String? address,
    String? userId,
  }) async {
    final doc = await CatalogService.addDoctor(
      firstName: firstName,
      lastName: lastName,
      specialization: specialization,
      address: address,
      userId: userId,
    );
    _doctorList.insert(0, doc);
    _selectedDoctor = doc;
    _customDoctorName = doc.displayName;
    notifyListeners();
    return doc;
  }

  // Add New Lab
  Future<LabModel> createLab({
    required String labName,
    String? labAddress,
    String? userId,
  }) async {
    final lab = await CatalogService.addLab(
      labName: labName,
      labAddress: labAddress,
      userId: userId,
    );
    _labList.insert(0, lab);
    _selectedLab = lab;
    _customLabName = lab.labName;
    notifyListeners();
    return lab;
  }

  // Submit Booking
  Future<Map<String, dynamic>> submitBooking({
    required String activeUserId,
    required String activeUsername,
  }) async {
    if (_patientName.trim().isEmpty) {
      throw Exception('Please enter Patient Name.');
    }
    if (_ageValue.trim().isEmpty) {
      throw Exception('Please enter Patient Age.');
    }
    if (_selectedItems.isEmpty) {
      throw Exception('Please select at least one test, panel, or package.');
    }

    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final now = DateTime.now();
      final dateStr = DateFormat('yyyy-MM-dd').format(now);
      final timeStr = DateFormat('HH:mm').format(now);

      final tableDataPayload = sampleVials.map((vial) {
        return {
          'typeOfSample': vial.sampleType,
          'barcodeId': vial.barcodeId,
          'confirmBarcodeId': vial.barcodeId,
          'testName': vial.testNames.join(', '),
          'ids': vial.ids,
        };
      }).toList();

      final testIdsPayload = _selectedItems.map((i) => i.id).toList();

      final bId = _barcodeId.isNotEmpty ? _barcodeId : generateBarcode();

      final fields = <String, String>{
        'barcodeId': bId,
        'date': dateStr,
        'time': timeStr,
        'createdbyuser': activeUsername,
        'patientName': _patientName.trim(),
        'year': '$_ageValue $_ageUnit'.trim(),
        'gender': _gender,
        'patientPhone': _patientPhone.trim(),
        'doctorName': doctorDisplayName.isNotEmpty ? doctorDisplayName : 'Self',
        'savedDoctor': doctorDisplayName,
        'savedDoctorId': _selectedDoctor?.id ?? '',
        'labName': labDisplayName,
        'savedLab': labDisplayName,
        'savedLabId': _selectedLab?.id ?? '',
        'clinicalHistory': _clinicalHistory.trim(),
        'total': grandTotal.toStringAsFixed(2),
        'discountamount': _discountAmount.toStringAsFixed(2),
        'discountunit': 'amount',
        'tableData': jsonEncode(tableDataPayload),
        'testIds': jsonEncode(testIdsPayload),
        'userId': activeUserId,
      };

      final result = await BookingService.createBooking(
        fields: fields,
        attachedFile: _attachedFile,
      );

      final confirmedBookingId = result['bookingId']?.toString() ??
          result['booking']?['bookingId']?.toString() ??
          bId;

      _isSubmitting = false;
      notifyListeners();

      return {
        'success': true,
        'bookingId': confirmedBookingId,
        'patientName': _patientName.trim(),
        'total': grandTotal,
        'sampleCount': sampleVials.length,
      };
    } catch (e) {
      _isSubmitting = false;
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      rethrow;
    }
  }

  void resetForm() {
    _patientName = '';
    _ageValue = '';
    _ageUnit = 'Yrs';
    _gender = 'Male';
    _patientPhone = '';
    _selectedDoctor = null;
    _customDoctorName = '';
    _selectedLab = null;
    _customLabName = '';
    _attachedFile = null;
    _discountAmount = 0.0;
    _clinicalHistory = '';
    _barcodeId = generateBarcode();
    _selectedItems.clear();
    _searchQuery = '';
    _catalogFilter = 'All';
    _errorMessage = null;
    notifyListeners();
  }
}

