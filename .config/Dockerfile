ARG grafana_version=latest
ARG grafana_image=grafana-enterprise

FROM grafana/${grafana_image}:${grafana_version}

ARG anonymous_auth_enabled=true
ARG development=false
ARG TARGETARCH
ARG trino_plugin_url=https://github.com/trinodb/grafana-trino/releases/download/v1.0.11/trino-datasource-1.0.11.zip
ARG infinity_plugin_url=https://github.com/grafana/grafana-infinity-datasource/releases/download/v3.6.0/yesoreyeram-infinity-datasource-3.6.0.zip


ENV DEV "${development}"

# Make it as simple as possible to access the grafana instance for development purposes
# Do NOT enable these settings in a public facing / production grafana instance
ENV GF_AUTH_ANONYMOUS_ORG_ROLE "Admin"
ENV GF_AUTH_ANONYMOUS_ENABLED "${anonymous_auth_enabled}"
ENV GF_AUTH_BASIC_ENABLED "false"
# Set development mode so plugins can be loaded without the need to sign
ENV GF_DEFAULT_APP_MODE "development"


LABEL maintainer="Grafana Labs <hello@grafana.com>"

ENV GF_PATHS_HOME="/usr/share/grafana"
WORKDIR $GF_PATHS_HOME

USER root

# Installing supervisor and inotify-tools
RUN if [ "${development}" = "true" ]; then \
  if grep -i -q alpine /etc/issue; then \
  apk add supervisor inotify-tools git; \
  elif grep -i -q ubuntu /etc/issue; then \
  DEBIAN_FRONTEND=noninteractive && \
  apt-get update && \
  apt-get install -y supervisor inotify-tools git && \
  rm -rf /var/lib/apt/lists/*; \
  else \
  echo 'ERROR: Unsupported base image' && /bin/false; \
  fi \
  fi

COPY supervisord/supervisord.conf /etc/supervisor.d/supervisord.ini
COPY supervisord/supervisord.conf /etc/supervisor/conf.d/supervisord.conf



# Inject livereload script into grafana index.html
RUN sed -i 's|</body>|<script src="http://localhost:35729/livereload.js"></script></body>|g' /usr/share/grafana/public/views/index.html


COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Preinstall Trino datasource from provided URL when available.
RUN if [ -n "${trino_plugin_url}" ]; then \
  grafana cli --pluginUrl "${trino_plugin_url}" plugins install trino-datasource || exit 1; \
  fi

# Preinstall Infinity datasource from provided URL when available.
RUN if [ -n "${infinity_plugin_url}" ]; then \
  grafana cli --pluginUrl "${infinity_plugin_url}" plugins install yesoreyeram-infinity-datasource || exit 1; \
  fi

ENTRYPOINT ["/entrypoint.sh"]
