class LabModel {
  final String id;
  final String labName;
  final String? labAddress;

  LabModel({
    required this.id,
    required this.labName,
    this.labAddress,
  });

  factory LabModel.fromJson(Map<String, dynamic> json) {
    return LabModel(
      id: json['_id']?.toString() ?? json['id']?.toString() ?? '',
      labName: json['LabName']?.toString() ?? json['labName']?.toString() ?? 'Unnamed Lab',
      labAddress: json['LabAddress']?.toString() ?? json['labAddress']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'labName': labName,
      'labAddress': labAddress,
    };
  }
}

