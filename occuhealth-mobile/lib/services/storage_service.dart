import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';

class StorageService {
  static const String _tokenKey = '@occuhealth_token';
  static const String _userKey = '@occuhealth_user';
  static const String _serverUrlKey = '@occuhealth_server_url';
  static const String defaultBaseUrl = 'https://occuhealth.in';

  static Future<void> saveToken(String token) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_tokenKey);
  }

  static Future<void> saveUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_userKey, jsonEncode(user.toJson()));
  }

  static Future<UserModel?> getUser() async {
    final prefs = await SharedPreferences.getInstance();
    final str = prefs.getString(_userKey);
    if (str == null || str.isEmpty) return null;
    try {
      final map = jsonDecode(str);
      return UserModel.fromJson(map);
    } catch (_) {
      return null;
    }
  }

  static Future<void> saveServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    String cleanUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    await prefs.setString(_serverUrlKey, cleanUrl);
  }

  static Future<String> getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final url = prefs.getString(_serverUrlKey);
    if (url != null && url.isNotEmpty) {
      return url.trim().replaceAll(RegExp(r'/+$'), '');
    }
    return defaultBaseUrl;
  }

  static Future<void> clearAll() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_userKey);
  }
}

