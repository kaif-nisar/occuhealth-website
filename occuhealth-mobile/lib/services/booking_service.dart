import 'dart:io';
import '../models/booking_model.dart';
import 'api_client.dart';

class BookingsSummary {
  final int total;
  final int pending;
  final int completed;
  final int attention;

  BookingsSummary({
    this.total = 0,
    this.pending = 0,
    this.completed = 0,
    this.attention = 0,
  });

  factory BookingsSummary.fromJson(Map<String, dynamic> json) {
    final partial = int.tryParse(json['partiallyCompleted']?.toString() ?? '0') ?? 0;
    final hold = int.tryParse(json['hold']?.toString() ?? '0') ?? 0;
    final clinical = int.tryParse(json['clinical']?.toString() ?? '0') ?? 0;

    return BookingsSummary(
      total: int.tryParse(json['total']?.toString() ?? '0') ?? 0,
      pending: int.tryParse(json['pending']?.toString() ?? '0') ?? 0,
      completed: int.tryParse(json['completed']?.toString() ?? '0') ?? 0,
      attention: partial + hold + clinical,
    );
  }
}

class BookingsListResult {
  final List<BookingModel> bookings;
  final int total;
  final int page;
  final int totalPages;
  final BookingsSummary summary;

  BookingsListResult({
    required this.bookings,
    this.total = 0,
    this.page = 1,
    this.totalPages = 1,
    required this.summary,
  });
}

class BookingService {
  // Create New Booking (Multipart Form Data with file support)
  static Future<Map<String, dynamic>> createBooking({
    required Map<String, String> fields,
    File? attachedFile,
  }) async {
    final response = await ApiClient.postMultipart(
      '/api/v1/user/new-booking',
      fields: fields,
      file: attachedFile,
      fileField: 'file',
    );

    if (!response.success) {
      throw Exception(response.message ?? 'Failed to submit booking');
    }

    if (response.data is Map) {
      return response.data as Map<String, dynamic>;
    }
    return {'success': true};
  }

  // List Bookings (Hierarchy Aware, identical to Franchise Portal & Admin Cases)
  static Future<BookingsListResult> listBookings({
    int page = 1,
    int limit = 20,
    String? status,
    String? bookingOrBarcode,
    String? patientName,
    String? mobileNumber,
    String? startDate,
    String? endDate,
    String? hierarchyUserId,
    String sortBy = 'latest',
    String sortOrder = 'desc',
  }) async {
    final queryParams = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
      'sortBy': sortBy,
      'sortOrder': sortOrder,
    };

    if (bookingOrBarcode != null && bookingOrBarcode.trim().isNotEmpty) {
      queryParams['bookingOrBarcode'] = bookingOrBarcode.trim();
    }
    if (patientName != null && patientName.trim().isNotEmpty) {
      queryParams['patientName'] = patientName.trim();
    }
    if (mobileNumber != null && mobileNumber.trim().isNotEmpty) {
      queryParams['mobileNumber'] = mobileNumber.trim();
    }
    if (status != null && status.trim().isNotEmpty) {
      queryParams['status'] = status.trim();
    }
    if (startDate != null && startDate.trim().isNotEmpty) {
      queryParams['startDate'] = startDate.trim();
    }
    if (endDate != null && endDate.trim().isNotEmpty) {
      queryParams['endDate'] = endDate.trim();
    }
    if (hierarchyUserId != null && hierarchyUserId.trim().isNotEmpty) {
      queryParams['hierarchyUserId'] = hierarchyUserId.trim();
    }

    final queryString = Uri(queryParameters: queryParams).query;
    final endpoint = '/api/v1/user/list-bookings-admin?$queryString';

    final response = await ApiClient.get(endpoint);

    if (!response.success) {
      // Fallback to get-bookings POST if list-bookings-admin returns 404/unauthorized
      return _fallbackGetBookings(page: page, limit: limit, queryParams: queryParams);
    }

    final data = response.data;
    if (data is! Map) {
      return BookingsListResult(bookings: [], summary: BookingsSummary());
    }

    List<BookingModel> items = [];
    if (data['bookings'] is List) {
      items = (data['bookings'] as List)
          .whereType<Map<String, dynamic>>()
          .map((j) => BookingModel.fromJson(j))
          .toList();
    }

    BookingsSummary summary = BookingsSummary();
    if (data['summary'] is Map) {
      summary = BookingsSummary.fromJson(data['summary'] as Map<String, dynamic>);
    }

    return BookingsListResult(
      bookings: items,
      total: int.tryParse(data['total']?.toString() ?? '0') ?? items.length,
      page: int.tryParse(data['page']?.toString() ?? '1') ?? page,
      totalPages: int.tryParse(data['totalPages']?.toString() ?? '1') ?? 1,
      summary: summary,
    );
  }

  // Fallback endpoint if list-bookings-admin is not available
  static Future<BookingsListResult> _fallbackGetBookings({
    required int page,
    required int limit,
    required Map<String, String> queryParams,
  }) async {
    final response = await ApiClient.post(
      '/api/v1/user/get-bookings?page=$page&limit=$limit',
      body: queryParams,
    );

    if (!response.success || response.data is! Map) {
      return BookingsListResult(bookings: [], summary: BookingsSummary());
    }

    final data = response.data as Map<String, dynamic>;
    List<BookingModel> items = [];
    if (data['bookings'] is List) {
      items = (data['bookings'] as List)
          .whereType<Map<String, dynamic>>()
          .map((j) => BookingModel.fromJson(j))
          .toList();
    }

    return BookingsListResult(
      bookings: items,
      total: int.tryParse(data['total']?.toString() ?? '0') ?? items.length,
      page: page,
      totalPages: 1,
      summary: BookingsSummary(total: items.length),
    );
  }

  // Update Booking Status
  static Future<bool> updateBookingStatus(String bookingId, String status) async {
    final response = await ApiClient.post(
      '/api/v1/user/update-booking-status',
      body: {
        'bookingId': bookingId,
        'status': status,
      },
    );
    return response.success;
  }
}

