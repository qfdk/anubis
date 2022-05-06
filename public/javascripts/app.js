$(document).ready(() => {
    const isRightIP = (ip) => {
        var reg = /^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])$/
        return reg.test(ip);
    }
    $("#banBtn").on('click', (e) => {
        e.preventDefault();
        const ip = $("#ip").val();
        if (isRightIP(ip)) {
            $("form").submit();
        } else {
            alert("IP 地址似乎无效！");
        }
    });
});