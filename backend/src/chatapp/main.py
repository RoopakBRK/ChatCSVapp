from fastapi import FastAPI
import uvicorn

app = FastAPI()

@app.get('/')
def welcome():
    return {"message": "Welcome to the ChatAPP"}

@app.post('/chat')

@app.post("/files")



if __name__ == "__main__":
    uvicorn.run(app,host='[IP_ADDRESS]',port=8000)

