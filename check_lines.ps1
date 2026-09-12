$f = Get-Content 'src\controllers\NewBooking.controller.js'
# Fix line 4319 (0-indexed 4318): fix try indentation to 4 spaces
$f[4318] = '    try {'
# Fix line 4325 (0-indexed 4324): fix corrupted em-dash character
$f[4324] = '        // This is the critical fix - previously a $or was used which returned every booking in the tenant.'
# Fix line 4320 (0-indexed 4319): fix andConditions indentation to 8 spaces
$f[4319] = '        const andConditions = [];'
[System.IO.File]::WriteAllLines('src\controllers\NewBooking.controller.js', $f)
Write-Output "Fixed try indentation and em-dash character."