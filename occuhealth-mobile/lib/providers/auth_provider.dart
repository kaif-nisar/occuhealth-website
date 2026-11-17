import 'package:flutter/material.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  UserModel? _user;
  bool _isLoading = false;
  String? _errorMessage;

  UserModel? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  bool get isAdmin => _user?.isAdmin ?? false;
  bool get isFranchisee => _user?.isFranchisee ?? true;
  bool get canEnterResult => _user?.canEnterResult ?? false;
  bool get canAccessReportFormat => _user?.canAccessReportFormat ?? false;

  Future<void> checkAuthStatus() async {
    _isLoading = true;
    notifyListeners();
    try {
      _user = await AuthService.getCurrentUser();
    } catch (_) {
      _user = null;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login({
    String? username,
    String? email,
    required String password,
  }) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _user = await AuthService.login(
        username: username,
        email: email,
        password: password,
      );
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    await AuthService.logout();
    _user = null;
    _isLoading = false;
    notifyListeners();
  }
}

