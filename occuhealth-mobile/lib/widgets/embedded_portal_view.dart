export 'embedded_portal_view_stub.dart'
    if (dart.library.html) 'embedded_portal_view_web.dart'
    if (dart.library.io) 'embedded_portal_view_mobile.dart';

