import os
import sys

# Script para promover um usuário comum a Administrador ou SuperAdmin (RBAC) via Firebase Admin SDK
# Requer credenciais do Service Account (firebase-adminsdk.json)

try:
    import firebase_admin
    from firebase_admin import credentials, firestore, auth
except ImportError:
    print("Erro: Instale o sdk primeiro: pip install firebase-admin")
    sys.exit(1)

def promote_user(email, role="admin"):
    try:
        # Tenta pegar credencial local (para ambiente dev)
        if not os.path.exists("serviceAccountKey.json"):
            print("❌ Arquivo serviceAccountKey.json não encontrado na raiz.")
            print("Vá em Firebase Console -> Configurações do Projeto -> Contas de Serviço -> Gerar Nova Chave Privada")
            return

        cred = credentials.Certificate("serviceAccountKey.json")
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)

        # 1. Pega o UID do usuário Auth a partir do email
        print(f"Buscando UID para o email: {email}...")
        try:
            user_record = auth.get_user_by_email(email)
            uid = user_record.uid
        except Exception as e:
            print(f"❌ Usuário não encontrado no Firebase Authentication. Ele já criou a conta na página de Checkout/Login?")
            return

        # 2. Insere/Atualiza a Role no Firestore (Zero-Trust Coleção 'users')
        db = firestore.client()
        user_ref = db.collection("users").document(uid)
        
        user_ref.set({
            "email": email,
            "role": role,
            "promotedAt": firestore.SERVER_TIMESTAMP
        }, merge=True)

        print(f"✅ SUCESSO: Usuário {email} (UID: {uid}) foi promovido a {role.upper()}!")
        print(f"Ele já pode logar no painel administrativo (/admin).")

    except Exception as e:
        print(f"Erro ao promover: {e}")

if __name__ == "__main__":
    print("--- 🛡️ GESTÃO DE ACESSOS (RBAC) ---")
    email = input("Digite o e-mail do usuário que receberá acesso: ")
    nivel = input("Qual o nível (admin/superadmin)? [padrão: admin]: ").strip().lower()
    
    if not nivel:
        nivel = "admin"
        
    promote_user(email, nivel)
