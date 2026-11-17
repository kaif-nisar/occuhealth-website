class DoctorModel {
  final String id;
  final String firstName;
  final String lastName;
  final String specialization;
  final String? address;
  final String? phone;

  DoctorModel({
    required this.id,
    required this.firstName,
    required this.lastName,
    required this.specialization,
    this.address,
    this.phone,
  });

  String get displayName => 'Dr. $firstName $lastName'.trim();
  String get fullTitle => '$displayName ($specialization)';

  factory DoctorModel.fromJson(Map<String, dynamic> json) {
    return DoctorModel(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? json['firstname']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? json['lastname']?.toString() ?? '',
      specialization: json['specialization']?.toString() ?? 'General Physician',
      address: json['address']?.toString(),
      phone: json['phone']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'firstName': firstName,
      'lastName': lastName,
      'specialization': specialization,
      'address': address,
      'phone': phone,
    };
  }
}

