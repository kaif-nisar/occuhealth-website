import '../models/catalog_item_model.dart';
import '../models/doctor_model.dart';
import '../models/lab_model.dart';
import '../models/wallet_model.dart';
import 'api_client.dart';

class CatalogService {
  // Fetch Tests
  static Future<List<CatalogItemModel>> getAssignedTests(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/get-test?userId=$userId'
        : '/api/v1/user/get-test';

    final response = await ApiClient.post(endpoint);
    if (!response.success) return [];

    final data = response.data;
    List rawList = [];
    if (data is List) {
      rawList = data;
    } else if (data is Map) {
      rawList = data['tests'] ?? data['data'] ?? [];
    }

    return rawList
        .whereType<Map<String, dynamic>>()
        .map((j) => CatalogItemModel.fromTestJson(j))
        .toList();
  }

  // Fetch Panels
  static Future<List<CatalogItemModel>> getAllPanels(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/get-all-pannels?userId=$userId'
        : '/api/v1/user/get-all-pannels';

    final response = await ApiClient.post(endpoint);
    if (!response.success) return [];

    final data = response.data;
    List rawList = [];
    if (data is List) {
      rawList = data;
    } else if (data is Map) {
      rawList = data['panels'] ?? data['data'] ?? [];
    }

    return rawList
        .whereType<Map<String, dynamic>>()
        .map((j) => CatalogItemModel.fromPanelJson(j))
        .toList();
  }

  // Fetch Packages
  static Future<List<CatalogItemModel>> getAllPackages(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/get-all-packages?userId=$userId'
        : '/api/v1/user/get-all-packages';

    final response = await ApiClient.post(endpoint);
    if (!response.success) return [];

    final data = response.data;
    List rawList = [];
    if (data is List) {
      rawList = data;
    } else if (data is Map) {
      rawList = data['packages'] ?? data['data'] ?? [];
    }

    return rawList
        .whereType<Map<String, dynamic>>()
        .map((j) => CatalogItemModel.fromPackageJson(j))
        .toList();
  }

  // Fetch Doctors
  static Future<List<DoctorModel>> getAllDoctors(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/all-doctor?userId=$userId'
        : '/api/v1/user/all-doctor';

    final response = await ApiClient.get(endpoint);
    if (!response.success) return [];

    final data = response.data;
    List rawList = [];
    if (data is List) {
      rawList = data;
    } else if (data is Map) {
      rawList = data['message'] ?? data['doctors'] ?? [];
    }

    return rawList
        .whereType<Map<String, dynamic>>()
        .map((j) => DoctorModel.fromJson(j))
        .toList();
  }

  // Add New Doctor
  static Future<DoctorModel> addDoctor({
    required String firstName,
    required String lastName,
    required String specialization,
    String? address,
    String? userId,
  }) async {
    final payload = {
      'firstname': firstName.trim(),
      'lastname': lastName.trim(),
      'specialization': specialization.trim(),
      'address': address?.trim() ?? '',
      'userId': userId ?? '',
    };

    final response = await ApiClient.post('/api/v1/user/add-doctor', body: payload);
    if (!response.success) {
      throw Exception(response.message ?? 'Failed to register doctor');
    }

    final data = response.data;
    if (data is Map && data['data'] is Map) {
      return DoctorModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    return DoctorModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      firstName: firstName,
      lastName: lastName,
      specialization: specialization,
      address: address,
    );
  }

  // Fetch Labs
  static Future<List<LabModel>> getAllLabs(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/all-Lab?userId=$userId'
        : '/api/v1/user/all-Lab';

    final response = await ApiClient.get(endpoint);
    if (!response.success) return [];

    final data = response.data;
    List rawList = [];
    if (data is List) {
      rawList = data;
    } else if (data is Map) {
      rawList = data['message'] ?? data['labs'] ?? [];
    }

    return rawList
        .whereType<Map<String, dynamic>>()
        .map((j) => LabModel.fromJson(j))
        .toList();
  }

  // Add New Lab
  static Future<LabModel> addLab({
    required String labName,
    String? labAddress,
    String? userId,
  }) async {
    final payload = {
      'LabName': labName.trim(),
      'LabAddress': labAddress?.trim() ?? '',
      'userId': userId ?? '',
    };

    final response = await ApiClient.post('/api/v1/user/add-Lab', body: payload);
    if (!response.success) {
      throw Exception(response.message ?? 'Failed to register lab');
    }

    final data = response.data;
    if (data is Map && data['data'] is Map) {
      return LabModel.fromJson(data['data'] as Map<String, dynamic>);
    }
    return LabModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      labName: labName,
      labAddress: labAddress,
    );
  }

  // Fetch Super Franchisees / Hierarchy users
  static Future<List<Map<String, dynamic>>> getSuperFranchisees(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/get-super-franchisee?userId=$userId'
        : '/api/v1/user/get-super-franchisee';

    final response = await ApiClient.get(endpoint);
    if (!response.success) return [];

    final data = response.data;
    List rawList = [];
    if (data is List) {
      rawList = data;
    } else if (data is Map) {
      rawList = data['message'] ?? data['franchisees'] ?? [];
    }

    return rawList.whereType<Map<String, dynamic>>().toList();
  }

  // Fetch Wallet Balance
  static Future<WalletModel> getWalletBalance(String? userId) async {
    final endpoint = (userId != null && userId.isNotEmpty)
        ? '/api/v1/user/get-wallet-balance?userId=$userId'
        : '/api/v1/user/get-wallet-balance';

    final response = await ApiClient.get(endpoint);
    if (response.success && response.data is Map) {
      return WalletModel.fromJson(response.data as Map<String, dynamic>);
    }
    return WalletModel(balance: 0.0);
  }
}

