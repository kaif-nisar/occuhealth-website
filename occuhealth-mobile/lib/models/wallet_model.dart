class WalletModel {
  final double balance;
  final bool overdraftAllowed;
  final double overdraftLimit;

  WalletModel({
    required this.balance,
    this.overdraftAllowed = false,
    this.overdraftLimit = 0.0,
  });

  double get availableBalance =>
      overdraftAllowed ? (balance + overdraftLimit) : balance;

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    final bal = json['balance'] ?? json['walletBalance'] ?? 0;
    final limit = json['overdraftLimit'] ?? 0;
    return WalletModel(
      balance: double.tryParse(bal.toString()) ?? 0.0,
      overdraftAllowed: json['overdraftAllowed'] == true,
      overdraftLimit: double.tryParse(limit.toString()) ?? 0.0,
    );
  }
}

