from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import random
from functools import wraps
import boto3
import jwt
import requests
from botocore.exceptions import ClientError
from flask_jwt_extended import JWTManager
from jwt import PyJWKClient

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
CORS(app)  

jwtManager = JWTManager(app)
# Cognito
#USER_POOL_ID = os.getenv("USER_POOL_ID")
#APP_CLIENT_ID = os.getenv("APP_CLIENT_ID")
#COGNITO_REGION = os.getenv("COGNITO_REGION", "us-east-1")

USER_POOL_ID = "us-east-1_QsDLb0H97"
APP_CLIENT_ID = "7i4fodra08e1oss3hj79i7geq8"
COGNITO_REGION = "us-east-1"

# S3 Bucket
# S3_PROFILE_PICTURES = os.getenv("S3_PROFILE_PICTURES")
# S3_REGION = os.getenv("S3_REGION", "us-east-1")

S3_PROFILE_PICTURES = "266552-ttt-profile-pictures"
S3_REGION = "us-east-1"

# SNS Topic
# SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN")
# SNS_REGION = os.getenv("SNS_REGION", "us-east-1")

SNS_TOPIC_ARN = "arn:aws:sns:us-east-1:533267276546:game_ended_topic"
SNS_REGION = "us-east-1"

# DB
# DB_TABLE_NAME = os.getenv("DB_TABLE_NAME")
# DB_REGION = os.getenv("SNS_REGION", "us-east-1")

DB_TABLE_NAME = "Players"
DB_REGION = "us-east-1"



cognito_client = boto3.client("cognito-idp", region_name=COGNITO_REGION)
s3_client = boto3.client("s3", region_name=S3_REGION)
sns_client = boto3.client("sns", region_name=SNS_REGION)
dynamodb = boto3.resource("dynamodb", region_name=DB_REGION)
ranking_table = dynamodb.Table(DB_TABLE_NAME)

board = ['n', 'n' , 'n', 'n', 'n', 'n', 'n', 'n', 'n']
players = {'player1': None, 'player2': None}
current_player = None
winner = None
lock = True
gameRunning = False

COGNITO_ISSUER = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{USER_POOL_ID}"
jwks_url = f"{COGNITO_ISSUER}/.well-known/jwks.json"
jwk_client = PyJWKClient(jwks_url)

def decode_token(token):
    unverified_claims = jwt.decode(token, options={"verify_signature": False})
    unverified_claims["aud"] = unverified_claims.get("client_id")
    signing_key = jwk_client.get_signing_key_from_jwt(token).key
    decoded_token = jwt.decode(
        token,
        key=signing_key,
        algorithms=["RS256"],
        audience=APP_CLIENT_ID,
        issuer=COGNITO_ISSUER,
        options={"verify_signature": False},
    )
    return decoded_token


def token_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            token = request.headers["Authorization"].split(" ")[1]
        if not token:
            return jsonify({"message": "Token is missing!"}), 403
        try:
            decode_token(token)
        except Exception as e:
            return jsonify({"message": str(e)}), 403
        return f(*args, **kwargs)

    return decorated_function
    
@app.route("/register", methods=["POST"])
def register():
    username = request.form.get("nick")
    password = request.form.get("password")
    email = request.form.get("email")
    image = request.files.get("image")
    save_img_result = None

    try:
        response = cognito_client.sign_up(
            ClientId=APP_CLIENT_ID,
            Username=username,
            Password=password,
            UserAttributes=[{"Name": "email", "Value": email}],
        )
        save_img_result = save_image_to_s3(image, username)
        subscribe_to_topic_result = subscribe_to_topic(email)
        return jsonify({"message": "User registered successfully, Saving image status: {save_img_result},  Subscribing status: {subscribe_to_topic_result}."}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 400
        
def save_image_to_s3(image, username):
    if image:
        filename = f"{username}.png"
        try:
            s3_client.upload_fileobj(
                image,
                S3_PROFILE_PICTURES,
                filename,
                ExtraArgs={"ContentType": image.content_type},
            )
            return "Success"
        except ClientError as e:
            return str(e)

def subscribe_to_topic(email):
    try:
        sns_client.subscribe(TopicArn=SNS_TOPIC_ARN, Protocol="email", Endpoint=email)
        return "Subscribe successful."
    except Exception as e:
        return str(e)


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    username = data["nick"]
    password = data["password"]

    try:
        response = cognito_client.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": username,
                "PASSWORD": password,
            },
        )
        access_token = response["AuthenticationResult"]["AccessToken"]
        refresh_token = response["AuthenticationResult"]["RefreshToken"]
        expiresIn = response["AuthenticationResult"]["ExpiresIn"]
        return (
            jsonify(
                access_token=access_token,
                refresh_token=refresh_token,
                expiresIn=expiresIn,
            ),
            200,
        )
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/verify", methods=["POST"])
def verify():
    data = request.get_json()
    username = data["nick"]
    code = data["code"]
    try:
        response = cognito_client.confirm_sign_up(
            ClientId=APP_CLIENT_ID, Username=username, ConfirmationCode=code
        )
        return jsonify({"message": "User verified successfully"}), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/refresh_token", methods=["POST"])
def refresh_token():
    data = request.get_json()
    refresh_token = data["refresh_token"]

    try:
        response = cognito_client.initiate_auth(
            ClientId=APP_CLIENT_ID,
            AuthFlow="REFRESH_TOKEN_AUTH",
            AuthParameters={
                "REFRESH_TOKEN": refresh_token,
            },
        )
        new_access_token = response["AuthenticationResult"]["AccessToken"]
        return jsonify(access_token=new_access_token), 200
    except ClientError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/logout", methods=["POST"])
@token_required
def logout():
    data = request.get_json()
    access_token = data.get("access_token")

    if not access_token:
        return jsonify({"message": "Access token is missing!"}), 400

    try:
        response = cognito_client.global_sign_out(AccessToken=access_token)
        return jsonify({"message": "Successfully logged out!"}), 200
    except cognito_client.exceptions.NotAuthorizedException:
        return jsonify({"message": "The access token is not valid!"}), 400
    except Exception as e:
        return jsonify({"message": str(e)}), 500


@app.route('/register_for_game', methods=['POST'])
@token_required
def register_for_game():
    global players
    global current_player
    global gameRunning, lock
    
    token = request.headers["Authorization"].split(" ")[1]
    decoded_token = decode_token(token)
    username = decoded_token.get("username")

    if players['player1'] == username or players['player2'] == username:
        return jsonify({'status': 'taken', "nick": username})
    if not players['player1']:
        players['player1'] = username
        gameRunning = True
        return jsonify({'status': 'registered', "nick": username})  
    elif not players['player2']:
        players['player2'] = username
        current_player = players['player1']
        lock = False
        return jsonify({'status': 'registered', "nick": username})  
    else:
        return jsonify({'status': 'full', "nick": username})  

@app.route('/get_players', methods=['GET'])
@token_required
def get_players():
    return jsonify({'players': players})
    
@app.route("/image/<player>", methods=["GET"])
def get_player_image(player):
    image_data, error_message = get_image_data(f"{player}.png")
    if image_data:
        return Response(image_data, mimetype="image/png")
    else:
        return error_message, 400


def get_image_data(filename):
    try:
        response = s3_client.get_object(Bucket=S3_PROFILE_PICTURES, Key=filename)
        image_data = response["Body"].read()
        return (image_data, None)
    except Exception as e:
        return (None, str(e))

@app.route('/send_move', methods=['POST'])
@token_required
def send_move():
    global board, current_player, players, lock, gameRunning
    move = request.json.get('move')
    player = request.json.get('yourNick')
    
    if player == current_player and board[move] == 'n' and not lock:
        if player == players['player1']:
            board[move] = 'x'
            current_player = players['player2']
            checkWin()
            return jsonify({'status': 'success'})  
        elif player == players['player2']:
            board[move] = 'o'
            current_player = players['player1']
            checkWin()
            return jsonify({'status': 'success'})  
    else:
        return jsonify({'status': 'error', 'message': 'Invalid move'}) 
    
@app.route('/get_end', methods=['GET'])
@token_required
def get_end():
    return jsonify({'gameRunning': gameRunning})

@app.route('/end_game', methods=['POST'])
@token_required
def end_game():
    endRunningGame()
    return jsonify({'status': 'registered'})  

def endRunningGame():
    global board, current_player, players, lock, gameRunning, winner
    board = ['n', 'n' , 'n', 'n', 'n', 'n', 'n', 'n', 'n']
    players = {'player1': None, 'player2': None}
    current_player = None
    winner = None
    lock = True
    gameRunning = False



@app.route('/get_board', methods=['GET'])
@token_required
def get_board():
    return jsonify({'board': board})

@app.route('/get_winner', methods=['GET'])
@token_required
def get_winner():
    winnerNick = None
    if winner == None:
        return jsonify({'winner': 'None'})
    if winner == 'x':
        winnerNick = players['player1']
    elif winner =='o':
        winnerNick = players['player2']
    elif winner =='pat':
        winnerNick = 'pat'
    return jsonify({"p1": players["player1"], "p2": players["player2"], 'winner': winnerNick})

def checkWin():
    global winner, lock
    # poziomo
    if board[0] == board[1] == board[2] and board[2] != "n":
        winner = board[0]
        lock = True
    elif board[3] == board[4] == board[5] and board[5] != "n":
        winner = board[3]
        lock = True
    elif board[6] == board[7] == board[8] and board[8] != "n":
        winner = board[6]
        lock = True

    # pionowo
    elif board[0] == board[3] == board[6] and board[6] != "n":
        winner = board[0]
        lock = True
    elif board[1] == board[4] == board[7] and board[7] != "n":
        winner = board[1]
        lock = True
    elif board[2] == board[5] == board[8] and board[8] != "n":
        winner = board[2]
        lock = True

    # skosy
    elif board[0] == board[4] == board[8] and board[8] != "n":
        winner = board[0]
        lock = True
    elif board[2] == board[4] == board[6] and board[6] != "n":
        winner = board[2]
        lock = True
    elif "n" not in board:
        winner = 'pat'
        lock = True

@app.route("/get_rankings", methods=["GET"])
def get_rankings():
    try:
        response = ranking_table.scan()
        players = response["Items"]
        sorted_players = sorted(players, key=lambda x: x["result"], reverse=True)

        rank = 1
        previous_wins = -1
        current_rank = 0

        for player in sorted_players:
            if player["result"] != previous_wins:
                current_rank = rank
                previous_wins = player["result"]
            player["rank"] = current_rank
            rank += 1

        return jsonify(sorted_players), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500


if __name__ == '__main__':
    #app.run(debug=True)
    app.run(port=8080, host="0.0.0.0")
    
#python3 -m http.server --bind 0.0.0.0 8081