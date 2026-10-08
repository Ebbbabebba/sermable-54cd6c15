//  NotificationBridge.swift
//  Sermable – native side of src/lib/nativeNotifications.ts
//
//  Receives messages from the web app via
//    window.webkit.messageHandlers.scheduleNotification.postMessage({ id, title, body, timestamp })
//  and schedules a local notification. A message with an id that is already
//  pending REPLACES the earlier reminder (same identifier = same notification).
//
//  Optional: window.webkit.messageHandlers.cancelNotification.postMessage({ id })
//
//  Setup (where you create your WKWebView):
//
//      let bridge = NotificationBridge.shared
//      let config = WKWebViewConfiguration()
//      bridge.register(on: config.userContentController)
//      let webView = WKWebView(frame: .zero, configuration: config)
//
//  And in AppDelegate.application(_:didFinishLaunchingWithOptions:):
//
//      UNUserNotificationCenter.current().delegate = NotificationBridge.shared
//
//  No extra capability is needed for local notifications.

import Foundation
import UserNotifications
import WebKit

final class NotificationBridge: NSObject, WKScriptMessageHandler, UNUserNotificationCenterDelegate {

    static let shared = NotificationBridge()

    static let scheduleHandler = "scheduleNotification"
    static let cancelHandler = "cancelNotification"

    private let center = UNUserNotificationCenter.current()

    /// Adds both message handlers. Uses a weak proxy so the WKUserContentController
    /// does not create a retain cycle.
    func register(on controller: WKUserContentController) {
        let proxy = WeakScriptMessageHandler(self)
        controller.removeScriptMessageHandler(forName: Self.scheduleHandler)
        controller.removeScriptMessageHandler(forName: Self.cancelHandler)
        controller.add(proxy, name: Self.scheduleHandler)
        controller.add(proxy, name: Self.cancelHandler)
    }

    // MARK: - WKScriptMessageHandler

    func userContentController(_ userContentController: WKUserContentController,
                               didReceive message: WKScriptMessage) {
        guard let dict = message.body as? [String: Any],
              let id = dict["id"] as? String, !id.isEmpty else {
            print("[NotificationBridge] ignored message without id:", message.body)
            return
        }

        switch message.name {
        case Self.cancelHandler:
            center.removePendingNotificationRequests(withIdentifiers: [id])
            print("[NotificationBridge] cancelled \(id)")

        case Self.scheduleHandler:
            let title = dict["title"] as? String ?? "Sermable"
            let body = dict["body"] as? String ?? ""
            // JS sends seconds; accept Int or Double.
            let ts = (dict["timestamp"] as? NSNumber)?.doubleValue ?? 0
            schedule(id: id, title: title, body: body, fireDate: Date(timeIntervalSince1970: ts))

        default:
            break
        }
    }

    // MARK: - Scheduling

    private func schedule(id: String, title: String, body: String, fireDate: Date) {
        let interval = fireDate.timeIntervalSinceNow
        guard interval > 1 else {
            print("[NotificationBridge] \(id) is in the past – skipped")
            return
        }

        ensureAuthorization { [weak self] granted in
            guard let self = self, granted else {
                print("[NotificationBridge] notifications not authorized – \(id) skipped")
                return
            }

            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            content.userInfo = ["id": id, "source": "sermable-web"]

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
            let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

            // Same identifier → replace the previous pending reminder.
            self.center.removePendingNotificationRequests(withIdentifiers: [id])
            self.center.add(request) { error in
                if let error = error {
                    print("[NotificationBridge] failed to schedule \(id):", error)
                } else {
                    print("[NotificationBridge] scheduled \(id) at \(fireDate)")
                }
            }
        }
    }

    private func ensureAuthorization(_ completion: @escaping (Bool) -> Void) {
        center.getNotificationSettings { [weak self] settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                completion(true)
            case .notDetermined:
                self?.center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
                    completion(granted)
                }
            default:
                completion(false)
            }
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    /// Show the banner even when the app is open.
    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                willPresent notification: UNNotification,
                                withCompletionHandler completionHandler:
                                    @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .sound, .list])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter,
                                didReceive response: UNNotificationResponse,
                                withCompletionHandler completionHandler: @escaping () -> Void) {
        completionHandler()
    }
}

/// Prevents WKUserContentController from strongly retaining the bridge.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
        target?.userContentController(c, didReceive: m)
    }
}
