# ==============================================================================
# SettleHub Backend Multi-Stage Dockerfile (Optimized for Free-Tier 512MB RAM)
# ==============================================================================

# Stage 1: Build Application
FROM maven:3.9.9-eclipse-temurin-21-alpine AS builder
WORKDIR /build

# Cache dependency layer
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source and package fat JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Stage 2: Lightweight Production Runtime
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Run as non-root user for container security
RUN addgroup -S settlehub && adduser -S settlehub -G settlehub
USER settlehub:settlehub

# Copy packaged JAR from build stage
COPY --from=builder /build/target/settlehub-backend-*.jar app.jar

# JVM flags strictly tuned for Render / PaaS free-tier (512MB cgroup RAM limit):
# - MaxRAMPercentage=75.0 caps max heap at ~384MB, leaving headroom for native threads and metaspace
# - UseG1GC ensures responsive garbage collection under tight memory constraints
# - ExitOnOutOfMemoryError prevents frozen zombie processes
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0 -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError"
ENV PORT=8080

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
