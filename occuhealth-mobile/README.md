# OccuHealth Flutter Mobile Application (ऑक्यूहेल्थ मोबाइल ऐप)

OccuHealth का आधिकारिक और आधुनिक **Flutter Native Mobile Application** — पूरी तरह से Flutter (Dart) स्टैक पर निर्मित, जो Zomato, Swiggy, और शीर्ष हेल्थकेयर ऐप्स के स्तर का अत्यंत सहज, सुरुचिपूर्ण (Aesthetic) व तेज़ अनुभव प्रदान करता है।

---

## 🚀 मुख्य विशेषताएं (Key Features & Highlights)

### 1. 📋 Patient Register & New Booking (नया मरीज व बुकिंग)
- **सरल व सहज इंटरफ़ेस:** कोई भी नया उपयोगकर्ता केवल कुछ सेकंड में बिना किसी भ्रम के बुकिंग कर सकता है।
- **मरीज का विवरण:** Name, Age (Units: Years / Months / Days), Gender (Male, Female, Other), Mobile Number.
- **डॉक्टर सेलेक्शन व ऑन-द-स्पॉट एड:** ड्रॉपडाउन से डॉक्टर चुनें या सीधे `+ Add New Doctor` पर क्लिक करके नया डॉक्टर जोड़ें।
- **लैब सेलेक्शन व ऑन-द-स्पॉट एड:** अपनी पसंदीदा लैब चुनें या `+ Add New Lab` से तुरंत रजिस्टर करें।
- **प्रिस्क्रिप्शन / फाइल अटैचमेंट:** कैमरे से ली गई पर्ची या गैलरी / PDF फाइल को `Upload File` बटन से आसानी से जोड़ें।
- **टेस्ट सेलेक्शन लॉजिक (Interactive Test Transfer):**
  - Instant Search Bar व Category Pills (`All`, `Tests`, `Panels`, `Packages`)।
  - टेस्ट पर टैप करते ही वह सिलेक्ट हो जाता है और रियल-टाइम कुल कीमत में जुड़ जाता है।
  - दोबारा टैप या क्रॉस (`✕`) पर क्लिक करके तुरंत डीसिलेक्ट कर सकते हैं।
  - **Dynamic Sample Vials Grouping:** चुने गए टेस्ट्स के आधार पर ऑटोमैटिक सैंपल वायल (Serum, Blood, Urine आदि) जनरेट होते हैं और हर वायल को एक यूनीक `OHxxxxxxxx` बारकोड मिलता है।
- **डिस्काउंट व बिलिंग:** डिस्काउंट राशि डालें, सबटोटल व फाइनल ग्रैंड टोटल का लाइव कैलकुलेशन।
- **सबमिट कन्फर्मेशन पॉपअप (Interactive Success Modal):**
  - बुकिंग सबमिट होते ही एक सुंदर पॉपअप खुलता है जिसमें बुकिंग आईडी व विवरण दिखता है।
  - **दो स्पष्ट बटन (Visible Action Buttons):**
    1. **Enter Result (रिजल्ट डालें)** — एडमिन के लिए, जो सीधे इस केस के रिजल्ट पेज पर ले जाता है।
    2. **List Booking (बुकिंग लिस्ट देखें)** — बुकिंग लिस्ट पेज पर ले जाता है।
    3. *Book Another Patient* — अगले मरीज को तुरंत जोड़ने के लिए।

### 2. 📑 List Booking (फ्रेंचाइजी पोर्टल के समान सम्पूर्ण फीचर्स)
- **4 सारांश कार्ड्स (Summary Cards):** Total Bookings, Pending, Completed, Attention (Partial / Hold / Clinical)।
- **फिल्टर्स:** Booking ID / Barcode Search, Patient Name, Mobile Number, Status Filter (Booked, Pending, Partially Completed, Hold, Clinical, Completed, Cancelled)।
- **विस्तृत बुकिंग कार्ड्स:** Barcode Chips, Patient Demographics, Tests summary, Creation Date/Time, Price।
- **बुकिंग रसीद (Booking Slip / Receipt):** 1-क्लिक शेयर व डाउनलोड।

### 3. 🔬 Enter Result (लैब रिजल्ट पेज - केवल एडमिन के लिए)
- मुख्य सॉफ्टवेयर के `labreport.html` के समान हूबहू फीचर्स।
- टेस्ट व पैनल्स ग्रुपवाइज़ पैरामीटर्स (Test Name, Result Input, Unit, Normal Reference Range)।
- **Save Draft:** ड्राफ्ट के रूप में बिना फाइनल किए सेव करें।
- **Sign-off & Finalize:** रिजल्ट को NABL / स्टैंडर्ड लैब फॉरमेट में फाइनल व साइन-ऑफ करें।
- *सख्त सुरक्षा (RBAC):* फ्रेंचाइजी, सुपर फ्रेंचाइजी या सब-फ्रेंचाइजी को रिजल्ट डालने की अनुमति नहीं है।

### 4. 📄 Report Format (साइन-ऑफ व PDF डाउनलोड - केवल एडमिन के लिए)
- मुख्य सॉफ्टवेयर के `reportFormat.html` की तरह A4 फॉर्मेट प्रीव्यू।
- Sign-off Status Pill (`Pending Sign-off` vs `Signed Off`)।
- **Download Report PDF:** सर्वर से डायरेक्ट डाउनलोड और डिवाइस में तुरंत ओपन (`open_filex`)।
- **WhatsApp Share:** डॉक्टर या मरीज को सीधे व्हाट्सएप पर PDF शेयर करने की सुविधा।

---

## 🏗️ प्रोजेक्ट संरचना (Folder Structure)

```
occuhealth-mobile/
├── android/                   # Native Android setup & AndroidManifest
├── ios/                       # Native iOS setup & Info.plist
├── assets/                    # App icons, splash screens, logos
├── lib/
│   ├── main.dart              # MultiProvider & App Entry
│   ├── theme/
│   │   ├── app_colors.dart    # Medical Blue, Slate, Emerald palette
│   │   └── app_theme.dart     # Material 3 typography & styling
│   ├── models/
│   │   ├── user_model.dart    # User & RBAC roles
│   │   ├── catalog_item_model.dart # Tests, panels, packages
│   │   ├── booking_model.dart # Bookings, sample vials, statuses
│   │   ├── doctor_model.dart  # Doctor entity
│   │   ├── lab_model.dart     # Lab entity
│   │   ├── report_model.dart  # Result parameters & categories
│   │   └── wallet_model.dart  # Wallet & overdraft
│   ├── services/
│   │   ├── api_client.dart    # HTTP networking with Bearer Auth
│   │   ├── storage_service.dart # SharedPreferences persistence
│   │   ├── auth_service.dart  # Login, logout, session
│   │   ├── catalog_service.dart # Tests, panels, doctors, labs APIs
│   │   ├── booking_service.dart # Multipart booking & listing APIs
│   │   └── report_service.dart # Results, sign-off, PDF download & share
│   ├── providers/
│   │   ├── auth_provider.dart # Auth state & role management
│   │   ├── booking_provider.dart # List booking state & filters
│   │   └── new_booking_provider.dart # Interactive booking & sample grouping
│   ├── screens/
│   │   ├── splash_screen.dart # Animated splash & auto-login
│   │   ├── auth/login_screen.dart # Login & server URL settings
│   │   ├── dashboard/dashboard_screen.dart # Role-based dashboard
│   │   ├── booking/
│   │   │   ├── new_booking_screen.dart # New patient booking
│   │   │   └── list_bookings_screen.dart # Franchise list booking
│   │   ├── cases/all_cases_screen.dart # Admin cases management
│   │   └── reports/
│   │       ├── enter_result_screen.dart # Result entry
│   │       └── report_format_screen.dart # Sign-off & PDF download
│   └── widgets/
│       ├── custom_button.dart
│       ├── custom_text_field.dart
│       ├── status_badge.dart
│       ├── summary_card.dart
│       ├── add_doctor_dialog.dart
│       ├── add_lab_dialog.dart
│       └── booking_success_dialog.dart # Success popup with action buttons
└── pubspec.yaml               # Flutter dependencies & assets config
```

---

## 📲 ऐप कैसे चलाएं (How to Run)

### 1. डिपेंडेंसी इंस्टॉल करें:
```bash
cd occuhealth-mobile
flutter pub get
```

### 2. अपने कनेक्टेड Android / iOS डिवाइस या एमुलेटर पर चलाएं:
```bash
flutter run
```

### 3. रिलीज APK बिल्ड करने के लिए:
```bash
flutter build apk --release
```
बिल्ड होने के बाद APK फाइल `build/app/outputs/flutter-apk/app-release.apk` में उपलब्ध होगी।
