 // asyncHandler use for Handle web request
 // async await use for Handle inside the mathod watting time 
 // like finding encryptint decrypting
 
 const asyncHandler = (requestHandler)=> {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).
        catch((err) => next(err))
    }
}


export{ asyncHandler }