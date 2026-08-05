import SwiftUI
import CoreKit

struct LoginView: View {
    @EnvironmentObject var authManager: AuthManager

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var showRegisterSuccess = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Header
                    VStack(spacing: 12) {
                        BrandMark(size: 88)
                        Text(AppEnvironment.appName)
                            .font(.title)
                            .fontWeight(.bold)
                        Text("你的 AI 学习伙伴")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)
                    .padding(.bottom, 20)

                    // 邮箱
                    VStack(alignment: .leading, spacing: 4) {
                        Text("邮箱")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        TextField("请输入邮箱地址", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .disableAutocorrection(true)
                            .textFieldStyle(.roundedBorder)
                    }

                    // 密码
                    VStack(alignment: .leading, spacing: 4) {
                        Text("密码")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        SecureField("请输入密码（至少8位）", text: $password)
                            .textContentType(.password)
                            .textFieldStyle(.roundedBorder)
                    }

                    // 错误提示
                    if let errorMessage = errorMessage {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    // 登录按钮
                    Button {
                        Task { await performLogin() }
                    } label: {
                        if isLoading {
                            ProgressView()
                                .tint(.white)
                        } else {
                            Text("登录")
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .frame(maxWidth: .infinity)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)

                    // 注册按钮
                    Button {
                        Task { await performRegister() }
                    } label: {
                        Text("注册新账号")
                    }
                    .disabled(isLoading || email.isEmpty || password.count < 8)
                }
                .padding(.horizontal, 32)
            }
            .alert("注册成功", isPresented: $showRegisterSuccess) {
                Button("好的") {}
            } message: {
                Text("请前往邮箱完成验证后再登录。")
            }
        }
    }

    private func performLogin() async {
        isLoading = true
        errorMessage = nil
        do {
            try await authManager.login(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func performRegister() async {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await authManager.register(email: email, password: password)
            showRegisterSuccess = true
            password = ""
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

#Preview {
    LoginView()
}
