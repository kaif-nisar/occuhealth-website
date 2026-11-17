import '../models/user_model.dart';
import 'api_client.dart';
import 'storage_service.dart';

class AuthService {
  static Future<UserModel> login({
    String? username,
    String? email,
    required String password,
  }) async {
    final payload = <String, dynamic>{
      'password': password,
    };
    if (username != null && username.trim().isNotEmpty) {
      payload['username'] = username.trim();
    }
    if (email != null && email.trim().isNotEmpty) {
      payload['email'] = email.trim();
    }

    final response = await ApiClient.post('/api/v1/user/login-admin', body: payload);

    if (!response.success) {
      throw Exception(response.message ?? 'Invalid username or password');
    }

    final data = response.data;
    if (data is! Map) {
      throw Exception('Invalid server response');
    }

    final token = data['accessToken']?.toString() ?? data['token']?.toString();
    if (token == null || token.isEmpty) {
      throw Exception('Authentication token missing from response');
    }

    await StorageService.saveToken(token);
    final user = UserModel.fromJson(data as Map<String, dynamic>, token: token);
    await StorageService.saveUser(user);

    return user;
  }

  static Future<UserModel?> getCurrentUser() async {
    final response = await ApiClient.get('/api/v1/user/get-current-user');
    if (response.success && response.data is Map) {
      final token = await StorageService.getToken();
      final user = UserModel.fromJson(response.data as Map<String, dynamic>, token: token);
      await StorageService.saveUser(user);
      return user;
    }
    return await StorageService.getUser();
  }

  static Future<void> logout() async {
    try {
      await ApiClient.post('/api/v1/user/logout');
    } catch (_) {}
    await StorageService.clearAll();
  }
}

