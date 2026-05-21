async function franchiseelist(params) {
    const selecttag = document.getElementById('franchiseelist');
    const labfullname = document.getElementById('labname');
    let Array = [];

    async function convertSpecificImagesToBase64() {
        const images = document.querySelectorAll('.certificatedImgdiv img'); // Sabhi <img> tags select karna

            const firstImage = images[0]; // Pehla <img>

            try {
                firstImage.src = await imageToBase64(firstImage.src);
                console.log(firstImage);
            } catch (error) {
                console.error("Error converting image:", error);
            }
    }

    // Function jo image URL ko Base64 me convert karega
    async function imageToBase64(url) {
        const response = await fetch(url);
        const blob = await response.blob();

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }
    // Function call karna
    convertSpecificImagesToBase64();

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/get-super-franchisee?userId=${userId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`, // Include token if needed
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();
        if (data.success) {
            labfullname.value = user.fullName;
            const option = document.createElement('option');
            option.value = user.fullName;
            option.innerText = user.username;
            selecttag.appendChild(option);
            const franchiseelist = data.message;

            franchiseelist.forEach(element => {
                const option = document.createElement('option');
                option.value = element.fullName;
                option.innerText = element.username;
                selecttag.appendChild(option);
                Array.push(element);
            });
        }
    } catch (error) {
        console.log(error)
    }
    selecttag.addEventListener('change', function () {
        labfullname.value = selecttag.value;
    })
    document.getElementById('date').valueAsDate = new Date();

    const generatebtn = document.querySelector('.button');
    generatebtn.addEventListener('click', async function () {
        const object = Array.find(element => element.fullName === selecttag.value);
        console.log(object);
        document.querySelector(".namediv span").innerText = object.fullName;
        document.querySelector(".datediv").innerText = new Date(document.getElementById('date').valueAsDate).toLocaleDateString("en-GB");
        const pdfHtml = document.querySelector(".certificatedImgdiv").outerHTML;
        const pdfcss = document.getElementById("style").innerHTML;
        const userId = object._id;
        console.log(pdfHtml, pdfcss);
        try {
            const response = await fetch(`${BASE_URL}/api/v1/user/certificatepdfgenerator`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ pdfHtml, pdfcss, userId })
            });
            const pdfblob = await response.blob();
            const pdfUrl = URL.createObjectURL(pdfblob);
            if (response.ok) {
                const anchor = document.createElement("a");
                anchor.href = pdfUrl;
                anchor.download = `${object.fullName}-certificate.pdf`;
                document.body.appendChild(anchor);
                anchor.click();
                document.body.removeChild(anchor);
            }
        } catch (error) {
            console.log("error submitting data:", error);
        }
    })
}
franchiseelist();