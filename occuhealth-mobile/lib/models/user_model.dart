class UserModel {
  final String id;
  final String username;
  final String fullName;
  final String email;
  final String role;
  final String? phone;
  final String? labName;
  final String? logoUrl;
  final String? pdfFormat;
  final String? token;
  final Map<String, dynamic>? tenant;

  UserModel({
    required this.id,
    required this.username,
    required this.fullName,
    required this.email,
    required this.role,
    this.phone,
    this.labName,
    this.logoUrl,
    this.pdfFormat,
    this.token,
    this.tenant,
  });

  bool get isAdmin =>
      role.toLowerCase() == 'admin' || role.toLowerCase() == 'superadmin';

  bool get isFranchisee =>
      role.toLowerCase() == 'franchisee' ||
      role.toLowerCase() == 'superfranchisee' ||
      role.toLowerCase() == 'subfranchisee';

  // Strict RBAC: Only Admin can access Enter Result & Report Format
  bool get canEnterResult => isAdmin;
  bool get canAccessReportFormat => isAdmin;

  // Assigned website report format page (e.g. reportFormat, reportFormat1, reportFormat3, reportFormat4)
  String get assignedReportFormat {
    final fmt = (pdfFormat ?? '').trim();
    if (fmt.isNotEmpty) return fmt;
    return 'reportFormat';
  }

  String get roleDisplay {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'Admin';
      case 'superadmin':
        return 'Super Admin';
      case 'superfranchisee':
        return 'Super Franchise';
      case 'franchisee':
        return 'Franchise';
      case 'subfranchisee':
        return 'Sub Franchise';
      case 'staff':
        return 'Staff';
      default:
        return role;
    }
  }

  factory UserModel.fromJson(Map<String, dynamic> json, {String? token}) {
    final userData = json['userData'] ?? json['user'] ?? json;
    final roleStr = userData['role']?.toString() ?? 'franchisee';
    final createdByMap = userData['createdBy'] is Map ? userData['createdBy'] as Map : null;
    final tenantMap = userData['tenantId'] is Map<String, dynamic>
        ? userData['tenantId'] as Map<String, dynamic>
        : (userData['tenant'] is Map<String, dynamic> ? userData['tenant'] as Map<String, dynamic> : null);

    String? resolvedPdfFormat;
    if (roleStr.toLowerCase() == 'staff') {
      resolvedPdfFormat = createdByMap?['pdfFormat']?.toString() ?? userData['pdfFormat']?.toString();
    } else {
      resolvedPdfFormat = userData['pdfFormat']?.toString() ?? createdByMap?['pdfFormat']?.toString();
    }
    if ((resolvedPdfFormat == null || resolvedPdfFormat.trim().isEmpty) && tenantMap != null) {
      final adminDetails = tenantMap['adminDetails'];
      if (adminDetails is Map && adminDetails['userId'] is Map) {
        resolvedPdfFormat = adminDetails['userId']['pdfFormat']?.toString();
      }
    }

    return UserModel(
      id: userData['_id']?.toString() ?? userData['id']?.toString() ?? '',
      username: userData['username']?.toString() ?? '',
      fullName: userData['fullName']?.toString() ?? userData['name']?.toString() ?? userData['username']?.toString() ?? '',
      email: userData['email']?.toString() ?? '',
      role: roleStr,
      phone: userData['phoneNumber']?.toString() ?? userData['phone']?.toString(),
      labName: userData['LabName']?.toString() ?? userData['labName']?.toString(),
      logoUrl: userData['logo']?.toString(),
      pdfFormat: resolvedPdfFormat,
      token: token ?? json['accessToken']?.toString() ?? json['token']?.toString(),
      tenant: tenantMap,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'fullName': fullName,
      'email': email,
      'role': role,
      'phone': phone,
      'labName': labName,
      'logoUrl': logoUrl,
      'pdfFormat': pdfFormat,
      'token': token,
      'tenant': tenant,
    };
  }
}

