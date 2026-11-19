import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'storage_service.dart';

class ApiResponse {
  final bool success;
  final int statusCode;
  final dynamic data;
  final String? message;

  ApiResponse({
    required this.success,
    required this.statusCode,
    this.data,
    this.message,
  });
}

class ApiClient {
  static const Duration timeoutDuration = Duration(seconds: 35);

  static Future<Map<String, String>> _getHeaders({bool isMultipart = false}) async {
    final token = await StorageService.getToken();
    final headers = <String, String>{
      'Accept': 'application/json',
    };

    if (!isMultipart) {
      headers['Content-Type'] = 'application/json';
    }

    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }

    return headers;
  }

  /// Formats low-level HTTP / browser fetch exceptions into actionable English messages.
  static String _formatErrorMessage(Object e) {
    final errStr = e.toString();
    if (errStr.contains('Failed to fetch') || errStr.contains('XMLHttpRequest') || errStr.contains('ClientException')) {
      return 'Browser CORS Restriction: The browser blocked the cross-origin request to the server.\n'
          'Please launch the app using "node mobile_preview.js" or run as a native mobile/desktop build.';
    }
    return 'Unexpected error: $errStr';
  }

  static Future<ApiResponse> get(String endpoint) async {
    try {
      final baseUrl = await StorageService.getServerUrl();
      final uri = Uri.parse('$baseUrl$endpoint');
      final headers = await _getHeaders();

      final response = await http
          .get(uri, headers: headers)
          .timeout(timeoutDuration);

      return _handleResponse(response);
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please check your internet connection.',
      );
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 503,
        message: 'Unable to reach the server. Please check your network connection.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 500,
        message: _formatErrorMessage(e),
      );
    }
  }

  static Future<ApiResponse> post(String endpoint, {Map<String, dynamic>? body}) async {
    try {
      final baseUrl = await StorageService.getServerUrl();
      final uri = Uri.parse('$baseUrl$endpoint');
      final headers = await _getHeaders();

      final response = await http
          .post(
            uri,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(timeoutDuration);

      return _handleResponse(response);
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Request timed out. Please check your internet connection.',
      );
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 503,
        message: 'Unable to reach the server. Please check your network connection.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 500,
        message: _formatErrorMessage(e),
      );
    }
  }

  static Future<ApiResponse> postMultipart(
    String endpoint, {
    required Map<String, String> fields,
    File? file,
    String fileField = 'file',
  }) async {
    try {
      final baseUrl = await StorageService.getServerUrl();
      final uri = Uri.parse('$baseUrl$endpoint');
      final headers = await _getHeaders(isMultipart: true);

      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.fields.addAll(fields);

      if (file != null && await file.exists()) {
        final filename = file.path.split(Platform.pathSeparator).last;
        final extension = filename.split('.').last.toLowerCase();
        
        MediaType contentType = MediaType('application', 'octet-stream');
        if (extension == 'jpg' || extension == 'jpeg') {
          contentType = MediaType('image', 'jpeg');
        } else if (extension == 'png') {
          contentType = MediaType('image', 'png');
        } else if (extension == 'pdf') {
          contentType = MediaType('application', 'pdf');
        }

        final multipartFile = await http.MultipartFile.fromPath(
          fileField,
          file.path,
          filename: filename,
          contentType: contentType,
        );
        request.files.add(multipartFile);
      }

      final streamedResponse = await request.send().timeout(timeoutDuration);
      final response = await http.Response.fromStream(streamedResponse);

      return _handleResponse(response);
    } on TimeoutException {
      return ApiResponse(
        success: false,
        statusCode: 408,
        message: 'Upload timed out. Please try again.',
      );
    } on SocketException {
      return ApiResponse(
        success: false,
        statusCode: 503,
        message: 'Network error. Please check your internet connection.',
      );
    } catch (e) {
      return ApiResponse(
        success: false,
        statusCode: 500,
        message: _formatErrorMessage(e),
      );
    }
  }

  static ApiResponse _handleResponse(http.Response response) {
    dynamic parsedBody;
    try {
      parsedBody = jsonDecode(response.body);
    } catch (_) {
      parsedBody = response.body;
    }

    final isSuccess = response.statusCode >= 200 && response.statusCode < 300;

    String? errorMsg;
    if (!isSuccess) {
      if (parsedBody is Map) {
        errorMsg = parsedBody['message']?.toString() ??
            parsedBody['error']?.toString() ??
            'Request failed with status code ${response.statusCode}';
      } else {
        errorMsg = 'Request failed with status code ${response.statusCode}';
      }
    }

    return ApiResponse(
      success: isSuccess,
      statusCode: response.statusCode,
      data: parsedBody,
      message: errorMsg,
    );
  }
}

