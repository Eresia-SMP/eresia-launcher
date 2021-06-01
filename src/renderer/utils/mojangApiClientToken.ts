let mojangApiClientToken = localStorage.getItem("mojangApiClientToken");
if (!mojangApiClientToken) {
    mojangApiClientToken = Date.now().toString();
    localStorage.setItem("mojangApiClientToken", mojangApiClientToken);
}

export default mojangApiClientToken;
