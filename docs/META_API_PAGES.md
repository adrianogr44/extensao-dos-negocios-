# Facebook Pages API



The Facebook Pages API allows apps to manage Facebook Pages and access related features with required permissions. This API enables various page management tasks, such as posting content, reading insights, moderating comments, and receiving real-time updates.

**Key Components:**

* **Access tokens:** Authenticated tokens with the required permissions
* **Endpoints:** For performing operations (post, get, update, delete)
* **Webhooks:** For receiving real-time updates

## Authentication and Access Tokens

To interact with the Pages API, a Page access token is required. This token is obtained via user authentication and grants permissions to perform API actions as the Page.

### Generating a Page Access Token

1. The app requests the necessary permissions from the user.
2. The user authorizes the app.
3. The app exchanges the authorization code for a user access token.
4. The app uses the token to request a Page access token.

## Permissions and Features

Different endpoints require different permissions:

* `pages_show_list` – Show Pages managed by a user
* `pages_read_engagement` – Read content posted to the Page
* `pages_manage_posts` – Publish and schedule content
* `pages_manage_engagement` – Moderate comments, delete posts
* `pages_read_user_content` – Read user-generated content on the Page
* `pages_manage_metadata` – Manage settings for the Page
* `pages_manage_ads` – Create and manage ads for the Page
* `pages_manage_cta` – View and update call-to-action buttons
* `pages_messaging` – Manage and send messages on behalf of the Page
* `business_management` – Manage business assets related to the Page

## API Endpoints

### Page Information

Retrieve basic information about a Page.

**Request:**

`GET /<PAGE_ID>?fields=id,name,about,fan_count`

**Permissions:** `pages_show_list`, `pages_read_engagement`

### Posting Content

Create new posts on a Page.

**Request:**

`POST /{page-id}/feed`

**Parameters:**

* `message`
* `link`
* `picture`
* `published`

**Permissions:** `pages_manage_posts`

```  
POST /{page-id}/feed
Body:
{
  message: "Hello from the Pages API!"
}
```

### Comment Management

Read, create, and moderate comments on Page posts.

**Read comments:**

`GET /{object-id}/comments`

**Post a comment:**

`POST /{object-id}/comments`

**Delete a comment:**

`DELETE /<COMMENT_ID>`

**Permissions:** `pages_manage_engagement`

### Insights

Get analytics and metrics for a Page.

**Request:**

`GET /{page-id}/insights?metric=page_impressions,page_fans`

**Permissions:** `pages_read_engagement`

### Mentions

Retrieve posts or comments where the Page is mentioned.

**Request:**

`GET /{page-id}/tagged`

**Permissions:** `pages_read_user_content`

### Page Settings

Update or retrieve Page settings such as cover photo, description, or messaging preferences.

**Get settings:**

`GET /{page-id}?fields=cover,about,description`

**Update settings:**

`POST /{page-id}/settings`

**Permissions:** `pages_manage_metadata`

## Webhooks

Webhooks provide real-time updates for changes or events on the Page, such as new comments, likes, or messages.

### Setup

1. Configure a callback URL in the developer dashboard.
2. Subscribe to desired fields (e.g., `feed`, `mentions`, `messages`).
3. Your service will receive HTTP POST notifications for relevant events.

## App Review and Publishing

If your app needs extended permissions (most Page management features), a Facebook App Review is required.

### Review Steps

1. Request required permissions in the Developer dashboard.
2. Provide detailed use cases and screencast videos.
3. Submit for review and respond to feedback.

## Example Requests

### Posting a Message

### Getting Post Insights

### Moderating Comments

* Delete a comment:

## Error Handling

* Use Facebook error codes and messages to identify issues.
* Common errors: Invalid token, missing permissions, rate limits.
* Reference: [/docs/graph-api/using-graph-api/error-handling/](https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling)

## Best Practices

* Use the minimum permissions needed.
* Cache responses where possible.
* Handle paging for large result sets.
* Respect user privacy and Facebook policies.

## References

* [Facebook Pages API Documentation](https://developers.facebook.com/documentation/pages-api)
* [API Reference](https://developers.facebook.com/docs/graph-api/reference/page)
* [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks)

# Facebook Pages API

The Facebook Pages API from Meta allows apps to access and update a Facebook Page's settings and content, create and get Posts, get Comments on Page owned content, get Page insights, update actions that Users are able to perform on a Page, and much more.

This document contains the guides you will use to learn abour and implement the Facebook Pages API.

## Documentation Contents

We recommend you read each guide in the following order outlined in this document.

- [Overview](https://developers.facebook.com/documentation/pages-api/overview) – Learn about the components of the Pages API and how it works.

- [Create an app](https://developers.facebook.com/documentation/pages-api/overview) – Create a Meta app with the Pages API use case.

- [Getting Started](https://developers.facebook.com/documentation/pages-api/getting-started) – An introductory tutorial showing you how to publish a post to your Facebook Page.

- [Manage a Page](https://developers.facebook.com/documentation/pages-api/manage-pages) – Get a list of your Pages with tasks you can perform on each and Page access tokens, and update Page settings.

- [Posts and Comments](https://developers.facebook.com/documentation/pages-api/posts) – Create, publish, update, and delete Page posts and comments.

- [Page Insights](https://developers.facebook.com/documentation/pages-api/platforminsights/page) – Get insights into your Page posts.

- [Pages Search](https://developers.facebook.com/documentation/pages-api/search-pages) – Search for Pages.

- [Page Tabs](https://developers.facebook.com/documentation/pages-api) – Get list of tabs for your Page.

- [Meta Webhooks](https://developers.facebook.com/documentation/pages-api/webhooks-for-pages) – Get real-time notifications sent to your server for events that happen on your Page.

- [Upcoming Changes](https://developers.facebook.com/documentation/pages-api/pages/upcoming-changes) – Get notifications about upcoming changes Meta will be implementing on your Page.

- [Error Codes](https://developers.facebook.com/documentation/pages-api/error-codes) – View error codes and their description for errors you may encounter when implementing the Pages API.

- [Changelog](https://developers.facebook.com/documentation/pages-api/changelog) – View the log of changes for the Pages API.
