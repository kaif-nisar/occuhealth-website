import 'package:flutter/material.dart';
import '../models/booking_model.dart';
import '../services/booking_service.dart';

class BookingProvider extends ChangeNotifier {
  List<BookingModel> _bookings = [];
  BookingsSummary _summary = BookingsSummary();

  bool _isLoading = false;
  String? _errorMessage;

  int _page = 1;
  int _limit = 20;
  int _total = 0;
  int _totalPages = 1;

  // Filter states
  String _searchQuery = '';
  String _patientName = '';
  String _mobileNumber = '';
  String _statusFilter = '';
  String? _startDate;
  String? _endDate;
  String? _hierarchyUserId;
  String _sortBy = 'latest';
  String _sortOrder = 'desc';

  // Getters
  List<BookingModel> get bookings => _bookings;
  BookingsSummary get summary => _summary;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  int get page => _page;
  int get limit => _limit;
  int get total => _total;
  int get totalPages => _totalPages;

  String get searchQuery => _searchQuery;
  String get patientName => _patientName;
  String get mobileNumber => _mobileNumber;
  String get statusFilter => _statusFilter;
  String? get startDate => _startDate;
  String? get endDate => _endDate;
  String? get hierarchyUserId => _hierarchyUserId;
  String get sortBy => _sortBy;
  String get sortOrder => _sortOrder;

  bool get hasActiveFilters =>
      _searchQuery.isNotEmpty ||
      _patientName.isNotEmpty ||
      _mobileNumber.isNotEmpty ||
      _statusFilter.isNotEmpty ||
      _startDate != null ||
      _endDate != null ||
      _hierarchyUserId != null;

  Future<void> fetchBookings({bool refresh = false}) async {
    if (refresh) {
      _page = 1;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await BookingService.listBookings(
        page: _page,
        limit: _limit,
        status: _statusFilter,
        bookingOrBarcode: _searchQuery,
        patientName: _patientName,
        mobileNumber: _mobileNumber,
        startDate: _startDate,
        endDate: _endDate,
        hierarchyUserId: _hierarchyUserId,
        sortBy: _sortBy,
        sortOrder: _sortOrder,
      );

      _bookings = result.bookings;
      _total = result.total;
      _page = result.page;
      _totalPages = result.totalPages;
      _summary = result.summary;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    _page = 1;
    fetchBookings();
  }

  void setPatientName(String name) {
    _patientName = name;
  }

  void setMobileNumber(String mobile) {
    _mobileNumber = mobile;
  }

  void setStatusFilter(String status) {
    _statusFilter = status;
    _page = 1;
    fetchBookings();
  }

  void setDateRange(String? start, String? end) {
    _startDate = start;
    _endDate = end;
    _page = 1;
    fetchBookings();
  }

  void setHierarchyUser(String? userId) {
    _hierarchyUserId = userId;
    _page = 1;
    fetchBookings();
  }

  void setSort(String field, String order) {
    _sortBy = field;
    _sortOrder = order;
    _page = 1;
    fetchBookings();
  }

  void clearFilters() {
    _searchQuery = '';
    _patientName = '';
    _mobileNumber = '';
    _statusFilter = '';
    _startDate = null;
    _endDate = null;
    _hierarchyUserId = null;
    _sortBy = 'latest';
    _sortOrder = 'desc';
    _page = 1;
    fetchBookings();
  }

  void nextPage() {
    if (_page < _totalPages) {
      _page++;
      fetchBookings();
    }
  }

  void previousPage() {
    if (_page > 1) {
      _page--;
      fetchBookings();
    }
  }
}

